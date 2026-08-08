#!/usr/bin/env node
'use strict';

// Generate developer-facing state documentation and the compact panel payload
// from a prototype-root usecases.json. The matrix is intentionally declared:
// it documents meaningful product states without claiming that every possible
// combination of switches is a use case.
//
// Usage: node tools/build-usecases.js [--out docs/usecases.md]
//                                      [--json usecases.built.json]
//                                      [--no-capture] [--only UC-01]

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

class ToolError extends Error {}

const HELP = `Usage: node tools/build-usecases.js [options]

Reads usecases.json from the prototype root and writes developer documentation
plus the panel's usecases.built.json payload.

Options:
  --out <path>   Markdown output (default: docs/usecases.md)
  --json <path>  Panel JSON output (default: usecases.built.json)
  --no-capture   Do not open Chrome or create screenshots
  --only <id>    Generate/capture one declared use case after validating all states
  --help         Show this help
`;

function parseArgs(argv) {
  const options = { out: 'docs/usecases.md', json: 'usecases.built.json', capture: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--no-capture') {
      options.capture = false;
      continue;
    }
    if (arg === '--out' || arg === '--json' || arg === '--only') {
      const value = argv[++i];
      if (!value) throw new ToolError(arg + ' requires a value');
      options[arg.slice(2)] = value;
      continue;
    }
    throw new ToolError('unknown option: ' + arg + ' (use --help)');
  }
  return options;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertObject(value, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(label + ' must be an object');
    return false;
  }
  return true;
}

function validateMatrix(matrix, root) {
  const errors = [];
  const covered = new Set();
  if (!assertObject(matrix, 'usecases.json', errors)) throw new ToolError(errors.join('; '));
  const states = matrix.states;
  if (!assertObject(states, 'states', errors) || Object.keys(states).length === 0) {
    if (Object.keys(states || {}).length === 0) errors.push('states must declare at least one axis');
  }

  for (const [axis, definition] of Object.entries(states || {})) {
    if (!assertObject(definition, 'state "' + axis + '"', errors)) continue;
    if (!isNonEmptyString(definition.doc)) errors.push('state "' + axis + '" is missing doc');
    if (
      !assertObject(definition.options, 'state "' + axis + '" options', errors) ||
      Object.keys(definition.options).length === 0
    ) {
      if (Object.keys(definition.options || {}).length === 0)
        errors.push('state "' + axis + '" must declare at least one option');
      continue;
    }
    for (const [option, optionDefinition] of Object.entries(definition.options)) {
      if (!assertObject(optionDefinition, 'state "' + axis + '" option "' + option + '"', errors)) continue;
      if (!isNonEmptyString(optionDefinition.doc))
        errors.push('state "' + axis + '" option "' + option + '" is missing doc');
    }
  }

  if (!Array.isArray(matrix.usecases) || matrix.usecases.length === 0) {
    errors.push('usecases must be a non-empty array');
  }
  const ids = new Set();
  for (const [index, usecase] of (matrix.usecases || []).entries()) {
    const label = 'use case #' + (index + 1);
    if (!assertObject(usecase, label, errors)) continue;
    if (!isNonEmptyString(usecase.id)) errors.push(label + ' is missing id');
    else if (ids.has(usecase.id)) errors.push('duplicate use case id "' + usecase.id + '"');
    else ids.add(usecase.id);
    if (!isNonEmptyString(usecase.name)) errors.push(label + ' is missing name');
    if (!isNonEmptyString(usecase.story)) errors.push(label + ' is missing story');
    if (!Array.isArray(usecase.rules)) errors.push(label + ' rules must be an array');
    if (!Array.isArray(usecase.screens) || usecase.screens.length === 0) {
      errors.push(label + ' must name at least one screen');
    } else {
      for (const screen of usecase.screens) {
        if (!isNonEmptyString(screen)) {
          errors.push(label + ' has an invalid screen');
          continue;
        }
        const screenPath = safeScreenPath(root, screen, label, errors);
        if (screenPath && !fs.existsSync(screenPath)) errors.push(label + ' names a missing screen "' + screen + '"');
      }
    }
    if (!assertObject(usecase.state, label + ' state', errors)) continue;
    for (const [axis, option] of Object.entries(usecase.state || {})) {
      if (!Object.prototype.hasOwnProperty.call(states || {}, axis)) {
        errors.push(label + ' names unknown state axis "' + axis + '"');
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(states[axis].options || {}, option)) {
        errors.push(label + ' names unknown option "' + axis + '.' + option + '"');
        continue;
      }
      covered.add(axis + '\0' + option);
    }
  }
  for (const [axis, definition] of Object.entries(states || {})) {
    for (const option of Object.keys((definition && definition.options) || {})) {
      if (!covered.has(axis + '\0' + option))
        errors.push('state "' + axis + '" option "' + option + '" is not covered by any use case');
    }
  }
  if (errors.length) throw new ToolError(errors.join('; '));
  return matrix;
}

function safeScreenPath(root, screen, label, errors) {
  if (path.isAbsolute(screen)) {
    errors.push(label + ' screen must be relative: "' + screen + '"');
    return null;
  }
  const resolved = path.resolve(root, screen);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    errors.push(label + ' screen escapes the prototype root: "' + screen + '"');
    return null;
  }
  return resolved;
}

function queryForState(state, extra) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(state || {})) query.set(key, String(value));
  for (const [key, value] of Object.entries(extra || {})) query.set(key, String(value));
  const text = query.toString();
  return text ? '?' + text : '';
}

function deepLink(screen, state) {
  return screen + queryForState(state);
}

function viewportFor(screen, usecase) {
  if (usecase.viewport && typeof usecase.viewport === 'object' && !Array.isArray(usecase.viewport)) {
    const width = Number(usecase.viewport.width);
    if (Number.isFinite(width) && width > 0)
      return { name: usecase.viewport.name || (width < 700 ? 'mobile' : 'desktop'), width };
  }
  if (typeof usecase.viewport === 'string')
    return { name: usecase.viewport, width: usecase.viewport === 'mobile' ? 430 : 1440 };
  return /^m-/.test(path.basename(screen)) ? { name: 'mobile', width: 430 } : { name: 'desktop', width: 1440 };
}

function relativeScreenLink(outFile, root, screen, state) {
  const screenPath = path.resolve(root, screen);
  const relative = path.relative(path.dirname(outFile), screenPath).split(path.sep).join('/');
  return relative + queryForState(state);
}

function normaliseUsecase(usecase, root) {
  const screens = usecase.screens.map(screen => {
    const viewport = viewportFor(screen, usecase);
    return { screen, viewport: viewport.name, deepLink: deepLink(screen, usecase.state), width: viewport.width };
  });
  return {
    id: usecase.id,
    name: usecase.name,
    story: usecase.story,
    rules: usecase.rules,
    state: usecase.state,
    deepLink: screens[0].deepLink,
    screens,
  };
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function markdown(matrix, entries, outFile, root, captures, captureEnabled) {
  const lines = [
    '# Product use cases',
    '',
    'Generated from `usecases.json`. The matrix is declared rather than a full cross-product: every switch option is documented and appears in at least one product use case.',
    '',
    '## State reference',
    '',
  ];
  for (const [axis, definition] of Object.entries(matrix.states)) {
    lines.push('### ' + (definition.label || axis) + ' (`' + axis + '`)');
    lines.push('');
    lines.push(definition.doc);
    lines.push('');
    lines.push('| Option | Meaning |');
    lines.push('| --- | --- |');
    for (const [option, detail] of Object.entries(definition.options)) {
      lines.push(
        '| `' +
          option +
          '`' +
          (detail.label ? ' — ' + escapeMarkdown(detail.label) : '') +
          ' | ' +
          escapeMarkdown(detail.doc) +
          ' |'
      );
    }
    lines.push('');
  }
  for (const entry of entries) {
    lines.push('## ' + entry.id + ' — ' + entry.name);
    lines.push('');
    lines.push(entry.story);
    lines.push('');
    lines.push('### State');
    lines.push('');
    lines.push('| Axis | Selected option | Meaning |');
    lines.push('| --- | --- | --- |');
    for (const [axis, option] of Object.entries(entry.state)) {
      const axisDef = matrix.states[axis];
      const optionDef = axisDef.options[option];
      lines.push(
        '| ' +
          escapeMarkdown(axisDef.label || axis) +
          ' (`' +
          axis +
          '`) | `' +
          option +
          '`' +
          (optionDef.label ? ' — ' + escapeMarkdown(optionDef.label) : '') +
          ' | ' +
          escapeMarkdown(optionDef.doc) +
          ' |'
      );
    }
    lines.push('');
    lines.push('### Screens and deep links');
    lines.push('');
    for (const screen of entry.screens) {
      const docLink = relativeScreenLink(outFile, root, screen.screen, entry.state);
      const capture = captures.get(entry.id + '\0' + screen.screen);
      let line = '- **' + screen.viewport + '** — [' + screen.screen + '](' + docLink + ')';
      if (captureEnabled && capture) {
        const imageLink = path.relative(path.dirname(outFile), capture).split(path.sep).join('/');
        line += ' · [capture](' + imageLink + ')';
      }
      lines.push(line);
    }
    lines.push('');
    lines.push('### Engineering rules');
    lines.push('');
    if (entry.rules.length) entry.rules.forEach(rule => lines.push('- ' + rule));
    else lines.push('- No additional rules declared.');
    lines.push('');
  }
  return lines.join('\n') + '\n';
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

/* Kept as a local name because the capture path injects it as a dependency;
   the resolution itself is shared with the other browser tools, which used to
   hardcode the macOS path and therefore died on the CI runner. */
const chromePath = require('./chrome-path');

function timeout(promise, ms, description) {
  let timer;
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ToolError(description + ' timed out after ' + ms + ' ms')), ms);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

async function captureEntries(entries, root, outFile, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const loadPuppeteer = dependencies.loadPuppeteer || (() => require('puppeteer-core'));
  let puppeteer;
  try {
    puppeteer = loadPuppeteer();
  } catch (_) {
    throw new ToolError('capture requires puppeteer-core; run npm ci in tools/ or pass --no-capture');
  }
  const chrome = dependencies.chrome || chromePath();
  if (!fileSystem.existsSync(chrome))
    throw new ToolError('Chrome not found at ' + chrome + ' — set CHROME_PATH or pass --no-capture');
  const captureDir = path.join(path.dirname(outFile), 'usecases');
  const captureTimeout = dependencies.captureTimeoutMs ?? Number(process.env.USECASE_CAPTURE_TIMEOUT_MS || 90000);
  const captures = new Map();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: 'new',
      // Match the other prototype capture tools. Chromium's sandbox cannot
      // initialise inside several CI and local automation sandboxes.
      args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'],
    });
    for (const entry of entries) {
      for (const screen of entry.screens) {
        const source = path.resolve(root, screen.screen);
        const target = path.join(
          captureDir,
          entry.id + '-' + path.basename(screen.screen, path.extname(screen.screen)) + '.png'
        );
        const temporary = target + '.tmp-' + process.pid + '-' + Math.random().toString(36).slice(2, 8);
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: screen.width, height: 1200 });
          const url = pathToFileURL(source);
          for (const [key, value] of new URLSearchParams(queryForState(entry.state, { nopanel: 1 })))
            url.searchParams.set(key, value);
          await timeout(
            page.goto(url.toString(), { waitUntil: 'networkidle0', timeout: 60000 }),
            captureTimeout,
            'capture ' + entry.id + ' ' + screen.screen
          );
          await page.evaluate(() => document.fonts && document.fonts.ready);
          const height = await page.evaluate(() =>
            Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
          );
          // This is the Puppeteer equivalent of an explicit --window-size=<width>,<height>.
          await page.setViewport({ width: screen.width, height: Math.max(1, Math.ceil(height)) });
          fileSystem.mkdirSync(path.dirname(target), { recursive: true });
          await timeout(
            page.screenshot({ path: temporary, fullPage: false }),
            captureTimeout,
            'capture ' + entry.id + ' ' + screen.screen
          );
          fileSystem.renameSync(temporary, target);
          captures.set(entry.id + '\0' + screen.screen, target);
        } catch (error) {
          try {
            fileSystem.unlinkSync(temporary);
          } catch (_) {
            /* no partial capture remains */
          }
          throw error;
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  return captures;
}

function readMatrix(root) {
  const file = path.join(root, 'usecases.json');
  if (!fs.existsSync(file)) throw new ToolError('usecases.json not found at ' + file);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ToolError('could not parse usecases.json: ' + error.message);
  }
}

async function build(options, cwd = process.cwd()) {
  const root = path.resolve(cwd);
  const matrix = validateMatrix(readMatrix(root), root);
  let source = matrix.usecases;
  if (options.only) {
    source = source.filter(usecase => usecase.id === options.only);
    if (!source.length) throw new ToolError('no use case with id "' + options.only + '"');
  }
  const entries = source.map(usecase => normaliseUsecase(usecase, root));
  const markdownOutput = path.resolve(root, options.out);
  const jsonOutput = path.resolve(root, options.json);
  const captures = options.capture ? await captureEntries(entries, root, markdownOutput) : new Map();
  const panel = {
    generatedAt: new Date().toISOString(),
    states: matrix.states,
    usecases: entries.map(({ screens, ...entry }) => ({
      ...entry,
      screens: screens.map(({ width, ...screen }) => screen),
    })),
  };
  writeAtomic(markdownOutput, markdown(matrix, entries, markdownOutput, root, captures, options.capture));
  writeAtomic(jsonOutput, JSON.stringify(panel, null, 2) + '\n');
  return { markdownOutput, jsonOutput, entries, captureCount: captures.size };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    const result = await build(options);
    console.log(
      'wrote ' +
        result.entries.length +
        ' use cases (' +
        result.captureCount +
        ' captures) → ' +
        result.markdownOutput +
        ', ' +
        result.jsonOutput
    );
  } catch (error) {
    console.error('build-usecases: ' + (error && error.message ? error.message : String(error)));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  ToolError,
  parseArgs,
  validateMatrix,
  queryForState,
  deepLink,
  normaliseUsecase,
  markdown,
  captureEntries,
  build,
};
