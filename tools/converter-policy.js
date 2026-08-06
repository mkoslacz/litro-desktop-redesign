'use strict';

// The converter tools process prototype manifests and exported Figma files. Those
// inputs are intentionally portable, but are not trusted as filesystem paths, as
// resource declarations, or as a decision about what gets executed. This module is
// the sole policy boundary for all three classes of input so a new converter cannot
// quietly invent a less strict variant.

class ConverterPolicyError extends Error {
  constructor(code, message) {
    super(code + ': ' + message);
    this.name = 'ConverterPolicyError';
    this.code = code;
  }
}

class ConverterBudgetError extends ConverterPolicyError {
  constructor(limit, actual, label, maximum = CONVERTER_RESOURCE_BUDGET[limit]) {
    super(
      'CONVERTER_BUDGET_EXCEEDED',
      label + ' exceeds the converter ' + limit + ' budget (' + actual + ' > ' + maximum + ')'
    );
    this.name = 'ConverterBudgetError';
    this.limit = limit;
    this.actual = actual;
  }
}

// Owner: the design-prototype conversion boundary (decode, render, DOM dump and
// .fig export). These are deliberately operational rather than per-command knobs:
// a prototype manifest must not be able to turn a local import into an unbounded
// parser, browser session, or output writer.
const CONVERTER_RESOURCE_BUDGET = Object.freeze({
  // A local .fig input above this size is almost always an accidental binary dump;
  // reject it before asking Node to allocate the full file.
  maxInputBytes: 64 * 1024 * 1024,
  // Compressed canvas chunks can expand far beyond their on-disk size. A separate
  // ceiling keeps a small archive from becoming a process-sized allocation.
  maxDecompressedBytes: 128 * 1024 * 1024,
  // A valid canvas needs only a handful of chunks. This stops a tiny hostile file
  // from turning its four-byte length headers into an enormous JavaScript array.
  maxCanvasChunks: 4_096,
  // Covers decoded Figma nodes and captured DOM nodes. It is above normal export
  // sizes while retaining a deterministic ceiling for hostile or generated trees.
  maxGraphNodes: 250_000,
  // JavaScript recursive helpers remain stack-safe below this number and a deeper
  // document is not a useful portable prototype artifact.
  maxGraphDepth: 128,
  // Traversal does more work than node counting (parents, synthetic text and maps),
  // so this independently caps repeated edges and bookkeeping.
  maxTraversalSteps: 500_000,
  // A huge viewport magnifies browser memory use even when the DOM itself is small.
  maxViewportWidth: 10_000,
  // JSONL and DOM dumps must fit within a bounded promoted artifact.
  maxResultBytes: 64 * 1024 * 1024,
  // One end-to-end conversion cannot hold a browser forever. It aligns with the
  // existing per-frame 90-second ceiling in dump-frames.js.
  deadlineMs: 90_000,
  // Browser cleanup has its own short bound so an already failed conversion exits.
  cleanupMs: 5_000,
  // Font readiness is a network/browser wait, not a license to consume the whole
  // lifecycle. The overall deadline still wins if less time remains.
  fontWaitMs: 15_000,
});

// The third class, and the one place the decision is written down: which file in a
// prototype root is trusted to decide what program runs. None of them is.
//
// A prototype manifest is contained below — it names a script, never a program, and
// the script must resolve inside the root. `package.json` cannot be contained the
// same way: `npm run` hands its script string to a shell, and a shell string *is*
// arbitrary program execution, so there is no path left to resolve and no argument
// vector left to validate. Nor is that file a different trust class from its
// neighbours: it ships in the same untrusted prototype root, so "package.json is the
// project's own build configuration" is an assumption about the directory rather
// than a property of it — whoever can write one file there can write the other.
//
// The route is not removed, because a prototype root that really is its own project
// legitimately owns a renderer. It is gated on the operator instead. The reviewed
// exception therefore names *the invocation*, never a file: nothing read out of a
// prototype root is executed unless the person running the tool asks for it in this
// run, through a flag or an environment variable — neither of which anything inside
// the prototype root can set.
const EXECUTION_OPT_IN = Object.freeze({
  flag: '--allow-package-scripts',
  env: 'REFRESH_ALLOW_PACKAGE_SCRIPTS',
});

// An environment variable is a string, so the spellings a shell or CI file makes
// easy to leave lying around are refused explicitly rather than read as consent.
const EXECUTION_OPT_IN_DENIALS = new Set(['', '0', 'false', 'no', 'off']);

function executionOptInGranted(options = {}) {
  if (options.flag === true) return true;
  const declared = (options.env || process.env)[EXECUTION_OPT_IN.env];
  if (typeof declared !== 'string') return false;
  return !EXECUTION_OPT_IN_DENIALS.has(declared.trim().toLowerCase());
}

// Reporting a refused value is the other half of refusing it, and a value that
// reaches a terminal is still untrusted. JSON quoting escapes the C0 controls an
// ANSI sequence needs; the replacement covers DEL and the C1 range JSON leaves
// literal, and the ceiling keeps a generated manifest from owning the whole summary.
const UNTRUSTED_ECHO_LIMIT = 160;
const UNTRUSTED_C1_CONTROLS = /[\u007f-\u009f]/g;

function describeUntrustedValue(value, limit = UNTRUSTED_ECHO_LIMIT) {
  const text = String(value);
  const clipped = text.length > limit ? `${text.slice(0, limit)}...` : text;
  return JSON.stringify(clipped).replace(
    UNTRUSTED_C1_CONTROLS,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

function pathApi(options = {}) {
  return options.path || require('path');
}

function policyError(code, label, detail) {
  return new ConverterPolicyError(code, label + ' ' + detail);
}

function assertSafeIdentifier(value, label = 'identifier') {
  if (typeof value !== 'string' || !value.trim()) {
    throw policyError('CONVERTER_UNSAFE_IDENTIFIER', label, 'must be a non-empty identifier');
  }
  if (value.includes('\0') || /[\\/]/.test(value) || value === '.' || value === '..') {
    throw policyError('CONVERTER_UNSAFE_IDENTIFIER', label, 'must not contain a path separator');
  }
  return value;
}

function existingRealPath(file, fs, path) {
  if (!fs || typeof fs.existsSync !== 'function' || typeof fs.realpathSync !== 'function') return null;
  let candidate = file;
  while (candidate && !fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return null;
    candidate = parent;
  }
  if (!candidate) return null;
  try {
    return fs.realpathSync(candidate);
  } catch (_error) {
    return null;
  }
}

function isContained(root, candidate, path) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function resolveContainedPath(root, value, label, options = {}) {
  const path = pathApi(options);
  const fs = options.fs;
  const allowRoot = Boolean(options.allowRoot);
  if (typeof root !== 'string' || !root) throw new TypeError('root must be a non-empty path');
  if (typeof value !== 'string' || !value.trim()) {
    throw policyError('CONVERTER_UNSAFE_PATH', label, 'must be a non-empty relative path');
  }
  if (value.includes('\0') || value.includes('\\') || path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw policyError('CONVERTER_UNSAFE_PATH', label, 'must be relative to the prototype root');
  }

  const segments = value.split('/');
  if (segments.some(segment => segment === '..' || !segment)) {
    throw policyError('CONVERTER_UNSAFE_PATH', label, 'must not contain traversal components');
  }

  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, value);
  if (!isContained(resolvedRoot, resolved, path) || (!allowRoot && resolved === resolvedRoot)) {
    throw policyError('CONVERTER_UNSAFE_PATH', label, 'escapes the prototype root');
  }

  const realRoot = existingRealPath(resolvedRoot, fs, path);
  const realCandidate = existingRealPath(resolved, fs, path);
  if (realRoot && realCandidate && !isContained(realRoot, realCandidate, path)) {
    throw policyError('CONVERTER_UNSAFE_PATH', label, 'resolves through a symlink outside the prototype root');
  }
  return resolved;
}

function resolvePageReference(root, value, label, options = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw policyError('CONVERTER_UNSAFE_PATH', label, 'must be a non-empty page path');
  }
  if (value.includes('#')) {
    throw policyError('CONVERTER_UNSAFE_PATH', label, 'must not include a fragment');
  }
  const suffixStart = value.indexOf('?');
  const pathname = suffixStart === -1 ? value : value.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : value.slice(suffixStart);
  return { path: resolveContainedPath(root, pathname, label, options), suffix };
}

function resolveGenerationManifest(root, manifest, outputOverride, options = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw policyError('CONVERTER_UNSAFE_MANIFEST', 'prototype.json', 'must contain an object');
  }
  const rows = manifest.rows == null ? [] : manifest.rows;
  if (!Array.isArray(rows)) {
    throw policyError('CONVERTER_UNSAFE_MANIFEST', 'prototype.json rows', 'must be an array');
  }
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw policyError('CONVERTER_UNSAFE_MANIFEST', 'prototype.json row', 'must be an object');
    }
    const frames = row.frames == null ? [] : row.frames;
    if (!Array.isArray(frames)) {
      throw policyError('CONVERTER_UNSAFE_MANIFEST', 'prototype.json row frames', 'must be an array');
    }
    for (const frame of frames) {
      assertSafeIdentifier(frame && frame.id, 'prototype.json frame id');
    }
  }
  return {
    assets: resolveContainedPath(root, manifest.assets || 'assets', 'prototype.json assets', options),
    dumps: resolveContainedPath(root, manifest.dumpDir || 'tools/dumps', 'prototype.json dumpDir', options),
    out: resolveContainedPath(root, outputOverride || manifest.out || 'prototype.fig', 'prototype.json out', options),
    schemaFrom: resolveContainedPath(
      root,
      manifest.schemaFrom || 'tools/.schema/canvas.fig',
      'prototype.json schemaFrom',
      options
    ),
    thumbnail: manifest.thumbnail
      ? resolveContainedPath(root, manifest.thumbnail, 'prototype.json thumbnail', options)
      : null,
  };
}

function assertWithinBudget(value, limit, label, budget = CONVERTER_RESOURCE_BUDGET) {
  const maximum = budget[limit];
  if (!Number.isSafeInteger(maximum) || maximum < 0) {
    throw new TypeError('unknown converter budget: ' + limit);
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(label + ' must be a non-negative safe integer');
  }
  if (value > maximum) throw new ConverterBudgetError(limit, value, label, maximum);
  return value;
}

function temporarySibling(target, options = {}) {
  const random = options.random || Math.random;
  const pid = options.pid ?? process.pid;
  return target + '.tmp-' + pid + '-' + random().toString(36).slice(2, 8);
}

function writeFileAtomically(target, contents, options = {}) {
  const fs = options.fs || require('fs');
  const bytes = Buffer.isBuffer(contents) ? contents.length : Buffer.byteLength(contents);
  assertWithinBudget(bytes, 'maxResultBytes', 'conversion result');
  const temporary = temporarySibling(target, options);
  try {
    fs.writeFileSync(temporary, contents);
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch (_cleanupError) {
      // The original error is the actionable failure; cleanup is best effort.
    }
    throw error;
  }
  return target;
}

module.exports = {
  CONVERTER_RESOURCE_BUDGET,
  ConverterBudgetError,
  ConverterPolicyError,
  EXECUTION_OPT_IN,
  assertSafeIdentifier,
  assertWithinBudget,
  describeUntrustedValue,
  executionOptInGranted,
  resolveContainedPath,
  resolveGenerationManifest,
  resolvePageReference,
  temporarySibling,
  writeFileAtomically,
};
