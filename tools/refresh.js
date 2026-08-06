#!/usr/bin/env node
'use strict';

// Refresh every derived prototype artifact from one command.
//
//   node tools/refresh.js [--fast] [--only changelog|usecases|previews|fig]
//
// This script deliberately orchestrates the existing generators instead of growing
// another browser/capture implementation. A prototype may opt into hub-preview
// regeneration by declaring a script in prototype.json:
//
//   {
//     "refresh": {
//       "previews": {
//         "command": ["node", "tools/capture-previews.js"],
//         "timeoutMs": 120000
//       }
//     }
//   }
//
// A prototype manifest is data, never an instruction, so it names the *script* and
// never the program: the leading "node" is a required declaration tag, the process
// actually spawned is always this Node executable (process.execPath), and the script
// must resolve inside the prototype root through the same converter-policy
// containment every other manifest-derived value in this file goes through.
//
// Alternatively it can expose an existing `refresh:previews` npm script (in the
// prototype root or tools/). That route cannot be contained the same way — npm hands
// the script string to a shell — and package.json is no more trusted than any other
// file in the prototype root, so it runs only when the operator says so in the
// invocation: --allow-package-scripts, or REFRESH_ALLOW_PACKAGE_SCRIPTS in the
// environment. Without it the step is skipped and the summary prints the script it
// refused to run. converter-policy.js owns that decision and its reasoning.
//
// There is intentionally no fallback capture path here: the project that owns its hub
// previews owns the existing renderer too.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  EXECUTION_OPT_IN,
  describeUntrustedValue,
  executionOptInGranted,
  resolveContainedPath,
} = require('./converter-policy.js');

class RefreshError extends Error {}

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const ARTIFACTS = ['changelog', 'usecases', 'previews', 'fig'];

const HELP = `Usage: node tools/refresh.js [--fast] [${EXECUTION_OPT_IN.flag}] [--only changelog|usecases|previews|fig]

Regenerates derived prototype artifacts in dependency order:
  changelog -> usecases -> hub previews -> Figma export

Options:
  --fast        Skip every browser-dependent step (use-case captures, hub previews, Figma export).
  --only <name> Refresh exactly one logical artifact; it does not run the other steps.
  ${EXECUTION_OPT_IN.flag}
                Allow a refresh:previews script read out of the prototype root's
                package.json to run. npm hands that string to a shell, so it is
                arbitrary execution and needs this opt-in (or ${EXECUTION_OPT_IN.env}
                in the environment). A command declared in prototype.json is
                contained and never needs it.
  --help        Show this help.

Use cases are opt-in: without usecases.json that step is reported as skipped. The
Figma export is also opt-in: it needs prototype.json and its declared schema donor.
Hub preview generation must call a renderer already provided by the prototype:
declare refresh.previews.command in prototype.json as ["node", "<script inside the
prototype root>", ...arguments], or add a refresh:previews script to package.json or
tools/package.json and pass ${EXECUTION_OPT_IN.flag}. The manifest names the script,
never the program: the leading "node" is a declaration tag, this Node executable is
what actually runs, and the script must resolve inside the prototype root.
`;

function parseArgs(argv) {
  const options = { allowPackageScripts: false, fast: false, only: null };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--fast') {
      options.fast = true;
      continue;
    }
    if (arg === EXECUTION_OPT_IN.flag) {
      options.allowPackageScripts = true;
      continue;
    }
    if (arg === '--only') {
      const value = argv[++index];
      if (!ARTIFACTS.includes(value)) {
        throw new RefreshError('--only must name one of: ' + ARTIFACTS.join(', '));
      }
      options.only = value;
      continue;
    }
    throw new RefreshError('unknown option: ' + arg + ' (use --help)');
  }
  return options;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function relativePath(value, label) {
  return resolveContainedPath(ROOT, value, label, { fs, path });
}

function loadJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new RefreshError('could not parse ' + label + ': ' + error.message);
  }
}

function loadManifest() {
  const file = path.join(ROOT, 'prototype.json');
  if (!fs.existsSync(file)) return null;
  const manifest = loadJson(file, 'prototype.json');
  if (!isPlainObject(manifest)) throw new RefreshError('prototype.json must contain an object');
  return { file, manifest };
}

function positiveTimeout(value, label) {
  if (value == null || value === '') return DEFAULT_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw new RefreshError(label + ' must be a positive number of milliseconds');
  return Math.floor(timeout);
}

function scriptPath(name) {
  const script = path.join(__dirname, name);
  if (!fs.existsSync(script)) {
    throw new RefreshError('required generator is missing: tools/' + name);
  }
  return script;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fingerprint(file) {
  if (!fs.existsSync(file)) return 'missing';
  const stat = fs.statSync(file);
  if (stat.isFile()) return 'file:' + hashFile(file);
  if (!stat.isDirectory()) return 'other:' + stat.size + ':' + stat.mtimeMs;
  const parts = [];
  const walk = current => {
    for (const name of fs.readdirSync(current).sort()) {
      const child = path.join(current, name);
      const childStat = fs.statSync(child);
      const rel = path.relative(file, child).split(path.sep).join('/');
      if (childStat.isDirectory()) {
        parts.push('dir:' + rel);
        walk(child);
      } else if (childStat.isFile()) {
        parts.push('file:' + rel + ':' + hashFile(child));
      }
    }
  };
  walk(file);
  return 'dir:' + crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
}

function fingerprintPreviews() {
  const previews = fs
    .readdirSync(ROOT)
    .filter(name => /^preview-.*\.png$/i.test(name))
    .sort()
    .map(name => name + ':' + hashFile(path.join(ROOT, name)));
  return crypto.createHash('sha256').update(previews.join('\n')).digest('hex');
}

function stateChanged(before, after) {
  return before === after ? 'unchanged' : 'changed';
}

function spawnStep(label, command, args, timeoutMs, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let killTimer = null;
    let timer = null;
    let child;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (error) reject(error);
      else resolve();
    };
    try {
      child = spawn(command, args, { cwd, stdio: 'inherit', shell: false });
    } catch (error) {
      finish(new RefreshError(label + ' could not start: ' + error.message));
      return;
    }
    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, timeoutMs);
    child.once('error', error => finish(new RefreshError(label + ' could not start: ' + error.message)));
    child.once('close', (code, signal) => {
      if (timedOut) {
        finish(new RefreshError(label + ' timed out after ' + timeoutMs + ' ms'));
      } else if (code !== 0) {
        finish(
          new RefreshError(label + ' failed with exit code ' + (code == null ? String(signal || 'unknown') : code))
        );
      } else {
        finish();
      }
    });
  });
}

function shouldRun(options, artifact) {
  return !options.only || options.only === artifact;
}

function skip(summary, artifact, reason) {
  summary[artifact] = { status: 'skipped', reason };
}

// The lookup discovers, it does not decide: every plan it returns carries the script
// it came from and the requiresOptIn marker, because npm will run that string through
// a shell. refreshPreviews refuses any marked plan the operator did not ask for, so
// the gate sits on the plan rather than on the filename that produced it — the
// package.json under tools/ is inside the same untrusted root as the one above it.
function packagePreviewCommand(directories = [ROOT, __dirname]) {
  for (const directory of directories) {
    const file = path.join(directory, 'package.json');
    if (!fs.existsSync(file)) continue;
    const source = path.relative(ROOT, file) || 'package.json';
    const manifest = loadJson(file, source);
    if (
      !isPlainObject(manifest) ||
      !isPlainObject(manifest.scripts) ||
      typeof manifest.scripts['refresh:previews'] !== 'string'
    )
      continue;
    const plan = {
      command: 'npm',
      args: ['run', 'refresh:previews'],
      cwd: ROOT,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      requiresOptIn: true,
      script: manifest.scripts['refresh:previews'],
      source,
    };
    if (directory === directories[0]) return plan;
    return { ...plan, args: ['--prefix', directory, 'run', 'refresh:previews'] };
  }
  return null;
}

function optInRequiredReason(plan) {
  return (
    plan.source +
    ' declares refresh:previews ' +
    describeUntrustedValue(plan.script) +
    ', which npm would hand to a shell; pass ' +
    EXECUTION_OPT_IN.flag +
    ' or set ' +
    EXECUTION_OPT_IN.env +
    ' to run it'
  );
}

// The declaration tag a manifest must use where a shell would take a program name.
// It is matched exactly and then discarded: process.execPath is what gets spawned.
const DECLARED_INTERPRETER = 'node';

function declaredScriptPath(declared) {
  if (declared.length < 2) {
    throw new RefreshError(
      'prototype.json refresh.previews.command must name a script after "' + DECLARED_INTERPRETER + '"'
    );
  }
  const script = declared[1];
  // A node option is not a script: -e, --eval, -r and friends would hand the manifest
  // back the arbitrary execution the containment below exists to remove.
  if (script.startsWith('-')) {
    throw new RefreshError(
      'prototype.json refresh.previews.command[1] must be a script path inside the prototype root, not the option ' +
        script
    );
  }
  const resolved = relativePath(script, 'prototype.json refresh.previews.command[1]');
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new RefreshError(
      'prototype.json refresh.previews.command[1] names no file inside the prototype root: ' + script
    );
  }
  return resolved;
}

function declaredPreviewCommand(manifest) {
  const refresh = manifest && manifest.refresh;
  const previews = refresh && refresh.previews;
  if (previews == null) return null;
  if (!isPlainObject(previews)) throw new RefreshError('prototype.json refresh.previews must be an object');
  const declared = previews.command;
  if (!Array.isArray(declared) || declared.length === 0 || declared.some(part => typeof part !== 'string' || !part)) {
    throw new RefreshError('prototype.json refresh.previews.command must be a non-empty array of command arguments');
  }
  if (declared[0] !== DECLARED_INTERPRETER) {
    throw new RefreshError(
      'prototype.json refresh.previews.command[0] must be exactly "' +
        DECLARED_INTERPRETER +
        '": a prototype manifest declares a script, never the program to run (rejected ' +
        JSON.stringify(declared[0]) +
        ')'
    );
  }
  return {
    command: process.execPath,
    args: [declaredScriptPath(declared), ...declared.slice(2)],
    cwd: ROOT,
    timeoutMs: positiveTimeout(previews.timeoutMs, 'prototype.json refresh.previews.timeoutMs'),
  };
}

function describeCommand(plan) {
  return [plan.command, ...plan.args].join(' ');
}

async function refreshChangelog(options, summary) {
  if (!shouldRun(options, 'changelog')) return skip(summary, 'changelog', 'not selected by --only');
  const output = path.join(ROOT, 'changelog.json');
  const before = fingerprint(output);
  await spawnStep(
    'changelog generator',
    process.execPath,
    [scriptPath('build-changelog.js')],
    positiveTimeout(process.env.REFRESH_CHANGELOG_TIMEOUT_MS, 'REFRESH_CHANGELOG_TIMEOUT_MS')
  );
  summary.changelog = { status: stateChanged(before, fingerprint(output)) };
}

async function refreshUsecases(options, summary) {
  if (!shouldRun(options, 'usecases')) return skip(summary, 'usecases', 'not selected by --only');
  if (!fs.existsSync(path.join(ROOT, 'usecases.json')))
    return skip(summary, 'usecases', 'usecases.json is not configured');
  const files = [
    path.join(ROOT, 'usecases.built.json'),
    path.join(ROOT, 'docs', 'usecases.md'),
    path.join(ROOT, 'docs', 'usecases'),
  ];
  const before = files.map(fingerprint).join('|');
  const args = [scriptPath('build-usecases.js')];
  if (options.fast) args.push('--no-capture');
  await spawnStep(
    'use-case generator',
    process.execPath,
    args,
    positiveTimeout(process.env.REFRESH_USECASES_TIMEOUT_MS, 'REFRESH_USECASES_TIMEOUT_MS')
  );
  summary.usecases = {
    status: stateChanged(before, files.map(fingerprint).join('|')),
    detail: options.fast ? 'captures skipped by --fast' : undefined,
  };
}

async function refreshPreviews(options, summary, manifest, run = spawnStep, lookupPackaged = packagePreviewCommand) {
  if (!shouldRun(options, 'previews')) return skip(summary, 'previews', 'not selected by --only');
  if (options.fast) return skip(summary, 'previews', '--fast skips browser work');
  const command = declaredPreviewCommand(manifest && manifest.manifest) || lookupPackaged();
  if (!command) return skip(summary, 'previews', 'no preview command configured');
  // The single execution site, so the operator gate cannot be walked around by a
  // second caller: a plan carrying an unconstrained project-supplied command runs
  // only when this invocation asked for it.
  // options.env is a test seam only: parseArgs never sets it, so a real run always
  // asks the process environment.
  if (command.requiresOptIn && !executionOptInGranted({ flag: options.allowPackageScripts, env: options.env }))
    return skip(summary, 'previews', optInRequiredReason(command));
  const before = fingerprintPreviews();
  await run('hub preview generator', command.command, command.args, command.timeoutMs, command.cwd);
  // A step that executed a program says so: reporting only `unchanged` hides the run
  // itself, which is exactly how an unconstrained declared command stayed invisible.
  summary.previews = {
    status: stateChanged(before, fingerprintPreviews()),
    detail: 'ran ' + describeCommand(command),
  };
}

async function refreshFig(options, summary, manifest) {
  if (!shouldRun(options, 'fig')) return skip(summary, 'fig', 'not selected by --only');
  if (options.fast) return skip(summary, 'fig', '--fast skips browser work');
  if (!manifest) return skip(summary, 'fig', 'prototype.json is not configured');
  const schemaFrom = manifest.manifest.schemaFrom == null ? 'tools/.schema/canvas.fig' : manifest.manifest.schemaFrom;
  const donor = relativePath(schemaFrom, 'prototype.json schemaFrom');
  if (!fs.existsSync(donor))
    return skip(summary, 'fig', 'schema donor is not configured at ' + path.relative(ROOT, donor));
  const out = manifest.manifest.out == null ? 'prototype.fig' : manifest.manifest.out;
  const output = relativePath(out, 'prototype.json out');
  const before = fingerprint(output);
  await spawnStep(
    'frame dump',
    process.execPath,
    [scriptPath('dump-frames.js'), path.relative(ROOT, manifest.file)],
    positiveTimeout(process.env.REFRESH_DUMP_TIMEOUT_MS, 'REFRESH_DUMP_TIMEOUT_MS')
  );
  await spawnStep(
    'Figma generator',
    process.execPath,
    [scriptPath('generate-fig.js'), path.relative(ROOT, manifest.file), path.relative(ROOT, output)],
    positiveTimeout(process.env.REFRESH_FIG_TIMEOUT_MS, 'REFRESH_FIG_TIMEOUT_MS')
  );
  summary.fig = { status: stateChanged(before, fingerprint(output)) };
}

function printSummary(summary) {
  console.log('\nRefresh summary:');
  for (const artifact of ARTIFACTS) {
    const entry = summary[artifact] || { status: 'skipped', reason: 'not reached after a previous failure' };
    const extra = entry.reason || entry.detail;
    console.log('  ' + artifact + ': ' + entry.status + (extra ? ' (' + extra + ')' : ''));
  }
}

async function main() {
  let options;
  const summary = {};
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    const manifest = loadManifest();
    await refreshChangelog(options, summary);
    await refreshUsecases(options, summary);
    await refreshPreviews(options, summary, manifest);
    await refreshFig(options, summary, manifest);
    printSummary(summary);
  } catch (error) {
    const target = options && options.only;
    if (target && !summary[target]) summary[target] = { status: 'failed', reason: error.message };
    else {
      const incomplete = ARTIFACTS.find(artifact => shouldRun(options || {}, artifact) && !summary[artifact]);
      if (incomplete) summary[incomplete] = { status: 'failed', reason: error.message };
    }
    printSummary(summary);
    console.error('refresh: ' + (error && error.message ? error.message : String(error)));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  RefreshError,
  parseArgs,
  declaredPreviewCommand,
  describeCommand,
  fingerprint,
  fingerprintPreviews,
  packagePreviewCommand,
  refreshPreviews,
};
