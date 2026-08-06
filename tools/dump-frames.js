// Dump every frame listed in the manifest, ready for generate-fig.js.
//
//   node dump-frames.js [prototype.json] [frame-id ...]
//
// Each frame is rendered with `?nopanel=1` appended — export mode: the prototype
// settings panel is not built and fixed bars join the normal flow. Without it the
// bars are captured at the bottom edge of the capture window, which lands in the
// middle of a several-thousand-pixel-tall frame.
//
// Pass frame ids to re-dump only those (the slow part is Chrome, ~2-6 s per frame).
//
// The child never writes job.out directly: it writes a same-directory temp file that is
// renamed into place only after a clean, non-timed-out exit. A killed or crashed child
// then leaves no job.out at all, rather than a truncated one that generate-fig.js would
// read as a complete dump.
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const {
  CONVERTER_RESOURCE_BUDGET,
  assertSafeIdentifier,
  resolveContainedPath,
  resolvePageReference,
} = require('./converter-policy.js');

const DEFAULT_JOBS = 3;
const MIN_JOBS = 1;
const MAX_JOBS = 16;
const DEFAULT_FRAME_TIMEOUT_MS = 90_000;
const MIN_FRAME_TIMEOUT_MS = 1_000;
const MAX_FRAME_TIMEOUT_MS = 300_000;

class FrameDumpError extends Error {}

function configuredValue(environmentValue, manifestValue, fallback) {
  if (environmentValue !== undefined && environmentValue !== '') return environmentValue;
  if (manifestValue !== undefined && manifestValue !== null && manifestValue !== '') return manifestValue;
  return fallback;
}

function boundedPositiveInteger(value, label, minimum, maximum) {
  if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'string' && !value.trim())) {
    throw new FrameDumpError(label + ' must be a finite integer between ' + minimum + ' and ' + maximum);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new FrameDumpError(label + ' must be a finite integer between ' + minimum + ' and ' + maximum);
  }
  return number;
}

function resolveConfig(environment = process.env, manifest = {}) {
  return {
    jobs: boundedPositiveInteger(
      configuredValue(environment.JOBS, manifest.jobs, DEFAULT_JOBS),
      'JOBS',
      MIN_JOBS,
      MAX_JOBS
    ),
    frameTimeoutMs: boundedPositiveInteger(
      configuredValue(environment.FRAME_TIMEOUT_MS, manifest.frameTimeoutMs, DEFAULT_FRAME_TIMEOUT_MS),
      'FRAME_TIMEOUT_MS',
      MIN_FRAME_TIMEOUT_MS,
      MAX_FRAME_TIMEOUT_MS
    ),
  };
}

function createDependencies(overrides = {}) {
  const runtimePath = overrides.path || path;
  return {
    fs: overrides.fs || fs,
    path: runtimePath,
    spawn: overrides.spawn || spawn,
    setTimeout: overrides.setTimeout || setTimeout,
    clearTimeout: overrides.clearTimeout || clearTimeout,
    random: overrides.random || Math.random,
    pid: overrides.pid ?? process.pid,
    timeoutMs: overrides.timeoutMs ?? DEFAULT_FRAME_TIMEOUT_MS,
    execPath: overrides.execPath || process.execPath,
    dumpDomScript: overrides.dumpDomScript || runtimePath.join(__dirname, 'dump-dom.js'),
    env: overrides.env || process.env,
    log: overrides.log || console.log,
    runOne: overrides.runOne,
  };
}

function readInvocation(argv, deps) {
  const args = [...argv];
  const manifestPath = deps.path.resolve(args[0] && args[0].endsWith('.json') ? args.shift() : 'prototype.json');
  if (!deps.fs.existsSync(manifestPath)) {
    throw new FrameDumpError('manifest not found: ' + manifestPath + '  (see prototype.example.json)');
  }
  const manifest = JSON.parse(deps.fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new FrameDumpError('manifest must contain an object');
  }
  return {
    manifest,
    manifestPath,
    only: new Set(args.map(frameId => assertSafeIdentifier(frameId, 'requested frame id'))),
  };
}

function frameQueue(manifest, root, only, deps) {
  const policyOptions = { fs: deps.fs, path: deps.path };
  const dumps = resolveContainedPath(root, manifest.dumpDir || 'tools/dumps', 'prototype.json dumpDir', policyOptions);
  const pages = resolveContainedPath(root, manifest.pagesDir || '.', 'prototype.json pagesDir', {
    ...policyOptions,
    allowRoot: true,
  });
  const queue = [];
  for (const row of manifest.rows || []) {
    for (const frame of row.frames || []) {
      const id = assertSafeIdentifier(frame && frame.id, 'prototype.json frame id');
      if (only.size && !only.has(id)) continue;
      const page = resolvePageReference(pages, frame.page, 'prototype.json frame page', policyOptions);
      const separator = page.suffix.includes('?') ? '&' : '?';
      queue.push({
        id,
        url: pathToFileURL(page.path).href + page.suffix + separator + 'nopanel=1',
        width: boundedPositiveInteger(
          frame.width || manifest.width || 1440,
          'frame width',
          1,
          CONVERTER_RESOURCE_BUDGET.maxViewportWidth
        ),
        out: deps.path.join(dumps, 'dump-' + id + '.json'),
      });
    }
  }
  return { dumps, queue };
}

function tempOutput(job, deps) {
  return job.out + '.tmp-' + deps.pid + '-' + deps.random().toString(36).slice(2, 8);
}

function runOne(job, overrides = {}) {
  const deps = createDependencies(overrides);
  return new Promise(resolve => {
    const tmpOut = tempOutput(job, deps);
    let child;
    let timer = null;
    let settled = false;
    let timedOut = false;

    const cleanupTmp = () => {
      try {
        deps.fs.unlinkSync(tmpOut);
      } catch (_error) {
        // A failed spawn, early child error or successful rename can leave no temp file.
      }
    };
    const settle = outcome => {
      if (settled) return;
      settled = true;
      if (timer !== null) deps.clearTimeout(timer);

      if (outcome.kind === 'success') {
        try {
          // rename(2) within one directory is atomic on the platforms this tool targets;
          // the temp file lives beside its target so this is the only promotion path.
          deps.fs.renameSync(tmpOut, job.out);
          deps.log('  ok   ' + job.id);
          resolve({ ok: true, job });
          return;
        } catch (error) {
          cleanupTmp();
          deps.log('  FAIL ' + job.id + '  (' + job.url + ')  rename failed: ' + error.message);
          resolve({ ok: false, job, reason: 'rename' });
          return;
        }
      }

      cleanupTmp();
      if (outcome.kind === 'timeout') {
        deps.log('  FAIL ' + job.id + '  (' + job.url + ')  timed out after ' + deps.timeoutMs + ' ms, killed');
      } else if (outcome.kind === 'error') {
        deps.log('  FAIL ' + job.id + '  (' + job.url + ')  could not start: ' + outcome.error.message);
      } else {
        deps.log('  FAIL ' + job.id + '  (' + job.url + ')');
      }
      resolve({ ok: false, job, reason: outcome.kind });
    };

    try {
      child = deps.spawn(deps.execPath, [deps.dumpDomScript, job.url, tmpOut, String(job.width)], {
        stdio: 'ignore',
      });
    } catch (error) {
      settle({ kind: 'error', error });
      return;
    }

    timer = deps.setTimeout(() => {
      if (settled) return;
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch (_error) {
        // A child that has already gone away is still one timed-out failure.
      }
      settle({ kind: 'timeout' });
    }, deps.timeoutMs);
    child.on('error', error => settle(timedOut ? { kind: 'timeout' } : { kind: 'error', error }));
    child.once('close', code => {
      if (settled) return;
      if (timedOut) {
        settle({ kind: 'timeout' });
      } else {
        let outputExists = false;
        try {
          outputExists = deps.fs.existsSync(tmpOut);
        } catch (_error) {
          outputExists = false;
        }
        settle(code === 0 && outputExists ? { kind: 'success' } : { kind: 'close' });
      }
    });
  });
}

async function runQueue(queue, config, overrides = {}) {
  const deps = createDependencies(overrides);
  const running = new Set();
  const jobRunner = deps.runOne || runOne;
  let ok = 0;
  let fail = 0;

  const launch = job => {
    let tracked;
    tracked = Promise.resolve()
      .then(() => jobRunner(job, { ...deps, timeoutMs: config.frameTimeoutMs }))
      .then(
        result => {
          if (result.ok) ok++;
          else fail++;
          running.delete(tracked);
          return result;
        },
        error => {
          fail++;
          deps.log('  FAIL ' + job.id + '  (' + job.url + ')  unexpected error: ' + error.message);
          running.delete(tracked);
          return { ok: false, job, reason: 'unexpected' };
        }
      );
    running.add(tracked);
  };

  for (const job of queue) {
    launch(job);
    if (running.size >= config.jobs) await Promise.race(running);
  }
  await Promise.all(running);
  return { ok, fail };
}

async function main(argv = process.argv.slice(2), overrides = {}) {
  const deps = createDependencies(overrides);
  const { manifest, manifestPath, only } = readInvocation(argv, deps);
  // Resolve before mkdir or spawn: a malformed setting may not allocate a dump
  // directory or start an unbounded browser burst merely to report its error.
  const config = resolveConfig(deps.env, manifest);
  const root = deps.path.dirname(manifestPath);
  const { dumps, queue } = frameQueue(manifest, root, only, deps);
  deps.fs.mkdirSync(dumps, { recursive: true });
  if (!queue.length) throw new FrameDumpError('nothing to dump');

  const result = await runQueue(queue, config, deps);
  deps.log(result.ok + ' dumped, ' + result.fail + ' failed → ' + dumps);
  return result.fail ? 1 : 0;
}

if (require.main === module) {
  main()
    .then(exitCode => {
      process.exitCode = exitCode;
    })
    .catch(error => {
      console.error(error && error.message ? error.message : String(error));
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_FRAME_TIMEOUT_MS,
  DEFAULT_JOBS,
  FrameDumpError,
  MAX_FRAME_TIMEOUT_MS,
  MAX_JOBS,
  MIN_FRAME_TIMEOUT_MS,
  MIN_JOBS,
  boundedPositiveInteger,
  frameQueue,
  main,
  readInvocation,
  resolveConfig,
  runOne,
  runQueue,
};
