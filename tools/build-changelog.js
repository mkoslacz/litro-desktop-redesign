#!/usr/bin/env node
'use strict';

// Build the static prototype's changelog after a workshop change has been
// committed. A generated file cannot contain the SHA of the commit that adds
// it, so refresh.js deliberately invokes this script after the useful commit.
//
// Usage: node tools/build-changelog.js [--limit 50] [--out changelog.json]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

class ToolError extends Error {}

const HISTORY_BATCH_SIZE = 100;
const LOG_FORMAT = '%x1e%H%x00%h%x00%ad%x00%s%x00%b%x00';
const ROUND_TAG_FORMAT = '%(refname:short)%00%(objecttype)%00%(objectname)%00%(*objecttype)%00%(*objectname)';

const HELP = `Usage: node tools/build-changelog.js [--limit 50] [--out changelog.json]

Writes a static changelog from non-merge Git commits, newest first.

Run this after the workshop change has been committed. A file cannot contain
the SHA of the same commit that writes it; the refresh workflow runs this step
after the commit so the newest useful entry has its real SHA.

Options:
  --limit <n>  Maximum number of non-generated entries to write (default: 50)
  --out <path> Output JSON path, relative to the prototype root (default: changelog.json)
  --help       Show this help
`;

function parseArgs(argv) {
  const options = { limit: 50, out: 'changelog.json' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--limit') {
      const value = argv[++i];
      if (!/^[1-9]\d*$/.test(value || '')) throw new ToolError('--limit must be a positive integer');
      options.limit = Number(value);
      continue;
    }
    if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new ToolError('--out requires a path');
      options.out = value;
      continue;
    }
    throw new ToolError('unknown option: ' + arg + ' (use --help)');
  }
  return options;
}

function createGitRunner({ execFileSync: execute = execFileSync } = {}) {
  function run(args, cwd, message, input) {
    try {
      const options = {
        cwd,
        encoding: 'utf8',
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      };
      if (input !== undefined) options.input = input;
      return String(execute('git', args, options)).trim();
    } catch (error) {
      const detail = error && error.stderr ? String(error.stderr).trim() : '';
      throw new ToolError(message + (detail ? ': ' + detail : ''));
    }
  }

  function tryRun(args, cwd) {
    try {
      return String(
        execute('git', args, {
          cwd,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      ).trim();
    } catch (_) {
      return null;
    }
  }

  return { run, tryRun };
}

function repositoryRoot(cwd, gitRunner) {
  const root = gitRunner.tryRun(['rev-parse', '--show-toplevel'], cwd);
  if (!root) throw new ToolError('not inside a Git repository');
  return root;
}

function normaliseGitHubRemote(remote) {
  if (!remote) return null;
  const scp = remote.match(/^(?:[^@]+@)?github\.com:([^/]+)\/(.+)$/i);
  if (scp) return normaliseRepositoryPath(scp[1], scp[2]);
  try {
    const url = new URL(remote);
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const [owner, ...rest] = url.pathname.replace(/^\/+/, '').split('/');
    return normaliseRepositoryPath(owner, rest.join('/'));
  } catch (_) {
    return null;
  }
}

function normaliseRepositoryPath(owner, repository) {
  const repo = String(repository || '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  if (!owner || !repo || repo.includes('/')) return null;
  return 'https://github.com/' + owner + '/' + repo;
}

function parseLog(output) {
  return output
    .split('\x1e')
    .slice(1)
    .map(record => {
      const fields = record.split('\0');
      const [sha, short, date, subject, body, ...files] = fields;
      return {
        sha: sha || '',
        short: short || '',
        date: date || '',
        subject: subject || '',
        body: (body || '').trim(),
        // Git inserts the normal log-record newline before the first --name-only
        // path even with -z. It is presentation whitespace, not part of a path.
        files: files.map(file => file.replace(/^\r?\n/, '')).filter(Boolean),
      };
    })
    .filter(entry => entry.sha);
}

function generatedArtifactOnly(files) {
  return (
    files.length > 0 &&
    files.every(file => {
      const name = file.replace(/\\/g, '/');
      return (
        name === 'changelog.json' ||
        name.endsWith('/changelog.json') ||
        name === 'usecases.built.json' ||
        name.endsWith('/usecases.built.json') ||
        name === 'docs/usecases.md' ||
        name.endsWith('/docs/usecases.md') ||
        /(^|\/)docs\/usecases(?:\/|$)/.test(name) ||
        /(^|\/)preview-[^/]+\.png$/i.test(name) ||
        /\.fig$/i.test(name)
      );
    })
  );
}

function parseRoundTags(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map(record => {
      const [tag, objectType, objectName, peeledType, peeledObjectName] = record.split('\0');
      const target = peeledType === 'commit' ? peeledObjectName : objectType === 'commit' ? objectName : null;
      return target && /^r[^\s]*$/i.test(tag) ? { tag, target } : null;
    })
    .filter(Boolean);
}

function loadRoundTags(root, gitRunner) {
  const raw = gitRunner.run(
    ['for-each-ref', '--format=' + ROUND_TAG_FORMAT, 'refs/tags'],
    root,
    'could not read Git tags'
  );
  return parseRoundTags(raw);
}

function parseRevisionGraph(output) {
  const nodes = new Map();
  for (const line of output.split(/\r?\n/)) {
    const [sha, ...parents] = line.trim().split(/\s+/);
    if (!sha) continue;
    nodes.set(sha, { children: [], parents, selectedMask: 0n, tagMask: 0n });
  }
  for (const [sha, node] of nodes) {
    for (const parent of node.parents) {
      const parentNode = nodes.get(parent);
      if (!parentNode) throw new ToolError('could not map changelog rounds');
      parentNode.children.push(sha);
    }
  }
  return nodes;
}

function bitIndexes(mask) {
  const indexes = [];
  for (let index = 0; mask; index += 1, mask >>= 1n) {
    if (mask & 1n) indexes.push(index);
  }
  return indexes;
}

function collectRevisionGraph(root, revisions, gitRunner) {
  const raw = gitRunner.run(
    ['rev-list', '--topo-order', '--parents', '--stdin'],
    root,
    'could not map changelog rounds',
    revisions.join('\n') + '\n'
  );
  return parseRevisionGraph(raw);
}

function mapRounds(entries, tags, graph) {
  if (!tags.length) return new Map();

  const entryBits = entries.map((entry, index) => ({ entry, bit: 1n << BigInt(index) }));
  const tagBits = tags.map((tag, index) => ({ tag, bit: 1n << BigInt(index) }));
  for (const { entry, bit } of entryBits) {
    const node = graph.get(entry.sha);
    if (!node) throw new ToolError('could not map changelog rounds');
    node.selectedMask |= bit;
  }
  for (const { tag, bit } of tagBits) {
    const node = graph.get(tag.target);
    if (!node) throw new ToolError('could not map changelog rounds');
    node.tagMask |= bit;
  }

  const remainingChildren = new Map();
  const queue = [];
  for (const [sha, node] of graph) {
    remainingChildren.set(sha, node.children.length);
    if (!node.children.length) queue.push(sha);
  }
  let processed = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = graph.get(queue[cursor]);
    processed += 1;
    for (const parent of node.parents) {
      const parentNode = graph.get(parent);
      parentNode.selectedMask |= node.selectedMask;
      parentNode.tagMask |= node.tagMask;
      const remaining = remainingChildren.get(parent) - 1;
      remainingChildren.set(parent, remaining);
      if (!remaining) queue.push(parent);
    }
  }
  if (processed !== graph.size) throw new ToolError('could not map changelog rounds');

  const tagCounts = Array(tags.length).fill(0);
  const sharedCounts = tags.map(() => Array(entries.length).fill(0));
  for (const node of graph.values()) {
    const selectedIndexes = bitIndexes(node.selectedMask);
    for (const tagIndex of bitIndexes(node.tagMask)) {
      tagCounts[tagIndex] += 1;
      for (const selectedIndex of selectedIndexes) sharedCounts[tagIndex][selectedIndex] += 1;
    }
  }

  const rounds = new Map();
  for (const [entryIndex, { entry }] of entryBits.entries()) {
    const node = graph.get(entry.sha);
    let best = null;
    for (const [tagIndex, { tag, bit }] of tagBits.entries()) {
      if (!(node.tagMask & bit)) continue;
      const distance = tagCounts[tagIndex] - sharedCounts[tagIndex][entryIndex];
      if (!best || distance < best.distance || (distance === best.distance && tag.tag < best.tag)) {
        best = { distance, tag: tag.tag };
      }
    }
    rounds.set(entry.sha, best ? best.tag : 'unreleased');
  }
  return rounds;
}

function closestRound(sha, rounds) {
  return rounds.get(sha) || 'unreleased';
}

function batchSize(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new ToolError('history batch size must be a positive integer');
  return value;
}

function loadEntries(root, repository, limit, gitRunner, configuredBatchSize = HISTORY_BATCH_SIZE) {
  const entries = [];
  const size = batchSize(configuredBatchSize);
  let skip = 0;
  while (entries.length < limit) {
    // Unit and record separators keep multi-line bodies and punctuation in subjects intact.
    const raw = gitRunner.run(
      [
        'log',
        '--no-merges',
        '--max-count=' + size,
        '--skip=' + skip,
        '--date=short',
        '--format=' + LOG_FORMAT,
        '--name-only',
        '-z',
      ],
      root,
      'could not read Git history'
    );
    const batch = parseLog(raw);
    if (!batch.length) break;
    skip += batch.length;
    for (const entry of batch.filter(entry => !generatedArtifactOnly(entry.files))) {
      entries.push(entry);
      if (entries.length === limit) break;
    }
    if (batch.length < size) break;
  }

  const tags = entries.length ? loadRoundTags(root, gitRunner) : [];
  const revisions = tags.length
    ? [...new Set([...entries.map(entry => entry.sha), ...tags.map(tag => tag.target)])]
    : [];
  const rounds = revisions.length
    ? mapRounds(entries, tags, collectRevisionGraph(root, revisions, gitRunner))
    : new Map();
  return entries.map(entry => ({
    sha: entry.sha,
    short: entry.short,
    date: entry.date,
    subject: entry.subject,
    body: entry.body,
    screens: entry.files.filter(file => /\.html$/i.test(file)),
    round: closestRound(entry.sha, rounds),
    url: repository ? repository + '/commit/' + entry.sha : null,
  }));
}

function writeAtomic(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + process.pid + '-' + Math.random().toString(36).slice(2, 8);
  try {
    fs.writeFileSync(temporary, contents);
    fs.renameSync(temporary, file);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (_) {
      /* promoted or already absent */
    }
  }
}

function build(options, cwd = process.cwd(), dependencies = {}) {
  const gitRunner = dependencies.gitRunner || createGitRunner(dependencies);
  const now = dependencies.now || (() => new Date());
  const root = repositoryRoot(cwd, gitRunner);
  if (gitRunner.run(['rev-parse', '--is-shallow-repository'], root, 'could not inspect Git history') === 'true') {
    throw new ToolError('Git history is shallow; fetch full history before generating the changelog');
  }
  const repository = normaliseGitHubRemote(gitRunner.tryRun(['remote', 'get-url', 'origin'], root));
  const output = path.resolve(cwd, options.out);
  const entries = loadEntries(
    root,
    repository,
    options.limit,
    gitRunner,
    dependencies.historyBatchSize ?? HISTORY_BATCH_SIZE
  );
  const document = {
    generatedAt: now().toISOString(),
    repository,
    limited: true,
    limit: options.limit,
    entries,
  };
  writeAtomic(output, JSON.stringify(document, null, 2) + '\n');
  return { output, document };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    const result = build(options);
    console.log('wrote ' + result.document.entries.length + ' changelog entries → ' + result.output);
  } catch (error) {
    console.error('build-changelog: ' + (error && error.message ? error.message : String(error)));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  ToolError,
  parseArgs,
  createGitRunner,
  normaliseGitHubRemote,
  parseLog,
  parseRoundTags,
  parseRevisionGraph,
  generatedArtifactOnly,
  loadEntries,
  mapRounds,
  build,
};
