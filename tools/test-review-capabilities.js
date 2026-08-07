#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const chromePath = require('./chrome-path');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_PAGES = ['changelog.html', 'usecases.html', 'comments.html'];
const REVIEW_LABELS = ['Changelog', 'Use cases', 'Comments'];
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'comments.config.schema.json'), 'utf8'));
const CONFIG = {
  prototypeId: 'capability-test',
  prototypeUrl: 'http://127.0.0.1/capability-test/',
  firebase: {
    apiKey: 'test-only',
    authDomain: 'test.invalid',
    projectId: 'test-only',
    appId: 'test-only',
  },
  stateKeys: ['auth', 'session', 'inv', 'density', 'per', 'rooms', 'pin'],
};

function contentType(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function localServer() {
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch (error) { response.writeHead(400).end('Bad request'); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (error, body) => {
      if (error) { response.writeHead(404).end('Not found'); return; }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentType(file),
      });
      response.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        baseUrl: 'http://127.0.0.1:' + address.port + '/',
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

function testPreload(schema, config, signedOut) {
  window.__PROTO_COMMENTS_TESTING__ = true;
  window.__capabilitySignedOut = Boolean(signedOut);
  window.__capabilityInitCalls = 0;
  window.__capabilityClientCreations = 0;
  window.__capabilityFacadeCalls = {};
  const THREADS_KEY = '__review_capability_threads_v1';
  const WRITES_KEY = '__review_capability_writes_v1';
  const CLOCK_KEY = '__review_capability_clock_v1';

  function readThreads() {
    try { return JSON.parse(localStorage.getItem(THREADS_KEY) || '[]'); }
    catch (error) { return []; }
  }
  function writes() { return Number(localStorage.getItem(WRITES_KEY) || 0); }
  function timestamp() {
    const previous = Number(localStorage.getItem(CLOCK_KEY) || 0);
    const next = Math.max(Date.now(), previous + 1);
    localStorage.setItem(CLOCK_KEY, String(next));
    return new Date(next).toISOString();
  }
  function saveThreads(threads, subscribers) {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    localStorage.setItem(WRITES_KEY, String(writes() + 1));
    subscribers.forEach(callback => callback(readThreads()));
  }
  function fakeClient() {
    window.__capabilityClientCreations += 1;
    const subscribers = new Set();
    const store = {
      list: async () => readThreads(),
      subscribe: callback => { subscribers.add(callback); return () => subscribers.delete(callback); },
      add: async (threadData, messageData) => {
        const threads = readThreads();
        const now = timestamp();
        const thread = Object.assign({}, threadData, {
          id: 'cap-thread-' + (threads.length + 1),
          status: 'open', createdAt: now, updatedAt: now,
          messages: [Object.assign({ id: 'message-1', createdAt: now }, messageData)],
        });
        threads.push(thread);
        saveThreads(threads, subscribers);
        return { id: thread.id, createdAt: now };
      },
      reply: async (id, messageData) => {
        const threads = readThreads();
        const thread = threads.find(item => item.id === id);
        if (!thread) throw new Error('FAKE_CLIENT_REPLY_TARGET_MISSING');
        const now = timestamp();
        thread.messages.push(Object.assign({ id: 'message-' + (thread.messages.length + 1), createdAt: now }, messageData));
        thread.updatedAt = now;
        saveThreads(threads, subscribers);
      },
      resolve: async (id, reviewer) => {
        const threads = readThreads();
        const thread = threads.find(item => item.id === id);
        if (!thread) throw new Error('FAKE_CLIENT_RESOLVE_TARGET_MISSING');
        const now = timestamp();
        Object.assign(thread, { status: 'resolved', resolvedAt: now, resolvedBy: reviewer, updatedAt: now });
        saveThreads(threads, subscribers);
      },
    };
    return {
      store,
      observeUser: callback => callback(window.__capabilitySignedOut ? null : {
        uid: 'reviewer-1', displayName: 'Capability Reviewer', email: 'reviewer@example.test',
      }),
      signIn: async () => null,
    };
  }

  let commentsApi;
  Object.defineProperty(window, 'protoComments', {
    configurable: true,
    get: () => commentsApi,
    set: api => {
      const originalInit = api.init.bind(api);
      api.init = async input => {
        window.__capabilityInitCalls += 1;
        const layer = await originalInit({
          config, schema,
          createFirebaseClient: fakeClient,
          overview: Boolean(input && input.overview),
        });
        if (layer) {
          ['threadsAt', 'loadDetail', 'startThread', 'replyTo', 'resolveThread'].forEach(name => {
            const original = layer[name].bind(layer);
            layer[name] = function () {
              window.__capabilityFacadeCalls[name] = (window.__capabilityFacadeCalls[name] || 0) + 1;
              return original.apply(layer, arguments);
            };
          });
          window.__capabilityLayer = layer;
        }
        return layer;
      };
      commentsApi = api;
    },
  });
}

async function newPage(browser, baseUrl, options) {
  const page = await browser.newPage();
  const localOrigin = new URL(baseUrl).origin;
  await page.setRequestInterception(true);
  const requests = [];
  page.on('request', request => {
    requests.push(request.url());
    const url = new URL(request.url());
    if (url.protocol === 'file:' || url.protocol === 'data:' || url.origin === localOrigin) request.continue();
    else request.abort();
  });
  await page.evaluateOnNewDocument(testPreload, SCHEMA, CONFIG, Boolean(options && options.signedOut));
  return { page, requests };
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
}

async function waitForDiscussion(page) {
  await page.waitForFunction(() => {
    const targets = document.querySelectorAll('[data-c]');
    return targets.length > 0 && document.querySelectorAll('.pd-discussion').length === targets.length;
  }, { timeout: 15000 });
}

async function runDiscussion(page, baseUrl, file, prefix, startBody, replyBody) {
  await goto(page, baseUrl + file + '?auth=in&inv=few');
  await waitForDiscussion(page);
  const target = await page.$eval('[data-c]', node => node.dataset.c);
  assert.ok(target.startsWith(prefix), file + ' has a stable data-derived target');
  const targets = await page.$$eval('[data-c]', nodes => nodes.map(node => node.dataset.c));
  assert.ok(targets.length > 0, file + ' discussion target set is non-empty');
  assert.equal(new Set(targets).size, targets.length, file + ' discussion targets are unique');

  const section = '[data-c="' + target + '"] > .pd-discussion';
  await page.type(section + ' > .pd-composer textarea', startBody);
  await page.click(section + ' > .pd-composer button[type="submit"]');
  await page.waitForSelector(section + ' .pd-thread[data-thread-id]', { timeout: 10000 });
  const threadId = await page.$eval(section + ' .pd-thread', node => node.dataset.threadId);

  await page.type(section + ' .pd-thread .pd-composer textarea', replyBody);
  await page.click(section + ' .pd-thread .pd-composer button[type="submit"]');
  try {
    await page.waitForFunction((selector, body) => {
      return Array.from(document.querySelectorAll(selector + ' .pd-message-body')).some(node => node.textContent === body);
    }, { timeout: 10000 }, section, replyBody);
  } catch (error) {
    const debug = await page.evaluate(selector => ({
      facade: window.__capabilityFacadeCalls,
      layer: window.__capabilityLayer && window.__capabilityLayer.threads,
      stored: JSON.parse(localStorage.getItem('__review_capability_threads_v1') || '[]'),
      section: document.querySelector(selector) && document.querySelector(selector).innerText,
    }), section);
    throw new Error(file + ' reply did not render: ' + JSON.stringify(debug));
  }
  await page.click(section + ' .pd-resolve');
  await page.waitForFunction(selector => {
    const status = document.querySelector(selector + ' .pd-status');
    return status && status.textContent === 'Resolved';
  }, { timeout: 10000 }, section);

  const evidence = await page.evaluate(() => ({
    calls: window.__capabilityFacadeCalls,
    clients: window.__capabilityClientCreations,
    threadIds: window.__capabilityLayer.threads.map(thread => thread.id),
  }));
  assert.equal(evidence.clients, 1, file + ' creates one injected comment client');
  ['threadsAt', 'startThread', 'replyTo', 'resolveThread'].forEach(name => {
    assert.ok(evidence.calls[name] > 0, file + ' delegates ' + name + ' to the shared facade');
  });
  assert.ok(evidence.threadIds.includes(threadId), file + ' facade retains the created thread');
  return { threadId, target };
}

async function testPanel(browser, baseUrl, file) {
  const { page, requests } = await newPage(browser, baseUrl);
  try {
    await goto(page, baseUrl + file + '?auth=in&density=c&inv=few&tag=a&tag=b#screen');
    await page.waitForSelector('.pt-review-pages a', { timeout: 15000 });
    const links = await page.$$eval('.pt-review-pages a', nodes => nodes.map(node => ({
      label: node.textContent.trim(), href: node.href, aria: node.getAttribute('aria-label'),
    })));
    assert.equal(links.length, 3, file + ' has exactly three review links');
    assert.deepEqual(links.map(link => link.label), REVIEW_LABELS, file + ' review labels are English');
    assert.deepEqual(links.map(link => new URL(link.href).pathname.split('/').pop()), REVIEW_PAGES);
    links.forEach(link => {
      const target = new URL(link.href);
      assert.equal(target.searchParams.get('auth'), 'in');
      assert.equal(target.searchParams.get('density'), 'c');
      assert.equal(target.searchParams.get('inv'), 'few');
      assert.deepEqual(target.searchParams.getAll('tag'), ['a', 'b']);
      assert.ok(/^Open the .+ review page$/.test(link.aria));
    });
    assert.equal(await page.$$('.pt-sheet, .pt-sheet-toggle, .pt-sheet-body').then(nodes => nodes.length), 0);
    assert.equal(requests.some(url => /\/(changelog|usecases\.built)\.json(?:\?|$)/.test(url)), false,
      file + ' panel does not fetch review data');

    const fragment = await page.evaluate(() => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      protoSheets.mount(host, {
        carry: 'extra=one&fixed=carried',
        changelog: { href: 'changelog.html?fixed=target#round-one', label: 'Changelog', ariaLabel: 'Open the changelog review page' },
      });
      return host.querySelector('a').href;
    });
    const fragmentUrl = new URL(fragment);
    assert.equal(fragmentUrl.hash, '#round-one', 'configured target fragment survives carry');
    assert.equal(fragmentUrl.searchParams.get('fixed'), 'target', 'configured target query wins');
    assert.equal(fragmentUrl.searchParams.get('extra'), 'one', 'explicit carry is appended');
  } finally {
    await page.close();
  }
}

async function testNopanel(browser, baseUrl, file) {
  const { page } = await newPage(browser, baseUrl);
  try {
    await goto(page, baseUrl + file + '?nopanel=1&auth=in&inv=few#export');
    const state = await page.evaluate(() => ({
      exportMode: document.body.dataset.export,
      panel: document.querySelectorAll('.proto-tools, .proto-rail').length,
      comments: document.querySelectorAll('.proto-comments-tools').length,
    }));
    assert.equal(state.exportMode, '1', file + ' keeps export mode');
    assert.equal(state.panel, 0, file + ' suppresses the demo panel under nopanel');
    assert.equal(state.comments, 0, file + ' does not change the comment toolbar footprint under nopanel');
  } finally {
    await page.close();
  }
}

async function testUsecaseCaptures(browser, baseUrl) {
  const { page } = await newPage(browser, baseUrl);
  try {
    await goto(page, baseUrl + 'usecases.html?auth=in&inv=few');
    await waitForDiscussion(page);
    await page.waitForSelector('.uc-shot-trigger[data-ready="true"]', { timeout: 30000 });
    const preview = await page.$eval('.uc-shot-trigger[data-ready="true"]', node => ({
      dialog: node.getAttribute('aria-haspopup'),
      label: node.getAttribute('aria-label'),
      width: Math.round(node.getBoundingClientRect().width),
      height: Math.round(node.querySelector('img').getBoundingClientRect().height),
    }));
    assert.equal(preview.dialog, 'dialog', 'use-case capture preview opens a dialog');
    assert.match(preview.label, /^Open full-size capture:/, 'use-case capture preview has an English action label');
    assert.ok(preview.width <= 236, 'use-case capture preview stays compact');
    assert.equal(preview.height, 144, 'use-case capture preview crops to a fixed scan-friendly height');

    await page.click('.uc-shot-trigger[data-ready="true"]');
    await page.waitForSelector('#uc-capture-dialog:not([hidden])', { timeout: 10000 });
    const dialog = await page.$eval('#uc-capture-dialog', node => ({
      role: node.getAttribute('role'),
      modal: node.getAttribute('aria-modal'),
      image: node.querySelector('#uc-capture-image').currentSrc,
      locked: document.body.classList.contains('uc-capture-open'),
    }));
    assert.equal(dialog.role, 'dialog');
    assert.equal(dialog.modal, 'true');
    assert.match(dialog.image, /\/docs\/usecases\/UC-\d+-[\w-]+\.png$/, 'dialog uses the original capture');
    assert.equal(dialog.locked, true, 'background scrolling is locked while the capture is open');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('uc-capture-dialog').hidden, { timeout: 10000 });
  } finally {
    await page.close();
  }
}

async function testFileFallback(browser, file) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'file:' || url.protocol === 'data:') request.continue();
    else request.abort();
  });
  await page.evaluateOnNewDocument(testPreload, SCHEMA, CONFIG, false);
  try {
    await goto(page, 'file://' + path.join(ROOT, file) + '?capability=1');
    const state = await page.evaluate(() => {
      const note = document.querySelector('.rp-file-note');
      return {
        fileOrigin: document.documentElement.dataset.origin,
        noteVisible: Boolean(note && getComputedStyle(note).display !== 'none'),
        discussion: document.querySelectorAll('.pd-discussion').length,
        commentUi: document.querySelectorAll('.proto-comments-tools').length,
        initCalls: window.__capabilityInitCalls,
      };
    });
    assert.equal(state.fileOrigin, 'file');
    assert.equal(state.noteVisible, true, file + ' explains the file:// boundary');
    assert.equal(state.discussion, 0, file + ' mounts no discussion under file://');
    assert.equal(state.commentUi, 0, file + ' creates no comment UI under file://');
    assert.equal(state.initCalls, 0, file + ' performs no comment initialization under file://');
  } finally {
    await page.close();
  }
}

function staticContracts() {
  const sheets = fs.readFileSync(path.join(ROOT, 'proto-sheets.js'), 'utf8');
  const discussion = fs.readFileSync(path.join(ROOT, 'proto-discussion.js'), 'utf8');
  const comments = fs.readFileSync(path.join(ROOT, 'proto-comments.js'), 'utf8');
  const usecases = fs.readFileSync(path.join(ROOT, 'usecases.html'), 'utf8');
  const reviewerFiles = ['index.html', 'changelog.html', 'usecases.html', 'comments.html',
    'proto-sheets.js', 'proto-discussion.js', 'proto-comments.js'];
  assert.equal(/\bfetch\s*\(/.test(sheets), false, 'panel navigation owns no fetch path');
  assert.equal(/pt-sheet(?:-toggle|-body)?/.test(sheets), false, 'panel navigation owns no preview sheet path');
  assert.equal(/firebase|firestore|createFirebaseClient|commentsStore/i.test(discussion), false,
    'discussion module contains no backend/client implementation');
  const layerMembers = [...discussion.matchAll(/layer\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]);
  assert.ok(layerMembers.length > 0, 'discussion module uses a comment-layer facade');
  const allowed = new Set(['threadsAt', 'loadDetail', 'startThread', 'replyTo', 'resolveThread', 'user', 'threadsDelivered']);
  assert.deepEqual([...new Set(layerMembers.filter(name => !allowed.has(name)))], [],
    'discussion module uses only the shared layer facade and its read-only state');
  ['threadsAt', 'loadDetail', 'startThread', 'replyTo', 'resolveThread'].forEach(name => {
    assert.match(comments, new RegExp('\\b' + name + '\\s*\\('), 'shared layer exposes ' + name);
  });
  assert.match(usecases, /setAttribute\('aria-haspopup', 'dialog'\)/, 'use-case captures provide an accessible full-size preview action');
  assert.match(usecases, /object-fit:\s*cover/, 'use-case captures render compact cropped previews');
  assert.match(usecases, /id="uc-capture-dialog"/, 'use-case captures retain one shared full-size dialog');
  const forbiddenReviewerChrome = /Înapoi|Schimbări|Cazuri de utilizare|Comentarii|Autentificare|Încarcă|Rezolvate|Deschise|Toate comentariile/;
  reviewerFiles.forEach(file => {
    assert.equal(forbiddenReviewerChrome.test(fs.readFileSync(path.join(ROOT, file), 'utf8')), false,
      file + ' contains no Romanian reviewer chrome');
  });
  assert.match(fs.readFileSync(path.join(ROOT, 'home-c.html'), 'utf8'), /<html lang="ro">[\s\S]*Caută/,
    'Romanian product screen remains Romanian');
  assert.match(fs.readFileSync(path.join(ROOT, 'home-c-en.html'), 'utf8'), /<html lang="en">[\s\S]*Search/,
    'English product screen remains English');
}

async function main() {
  staticContracts();
  console.log('PASS static contracts: one comment facade, no panel sheets/fetch, English reviewer chrome');
  const server = await localServer();
  const browser = await puppeteer.launch({
    executablePath: chromePath(), headless: 'new',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update'],
  });
  try {
    await testPanel(browser, server.baseUrl, 'home-c.html');
    await testPanel(browser, server.baseUrl, 'm-home.html');
    console.log('PASS panel navigation: desktop/mobile, three links, carried query/fragment, no duplicate sheets');

    await testNopanel(browser, server.baseUrl, 'home-c.html');
    await testNopanel(browser, server.baseUrl, 'm-home.html');
    console.log('PASS export mode: desktop/mobile nopanel suppression unchanged');

    await testUsecaseCaptures(browser, server.baseUrl);
    console.log('PASS use-case captures: compact previews open an accessible full-size dialog');

    const { page: discussionPage } = await newPage(browser, server.baseUrl);
    try {
      await goto(discussionPage, server.baseUrl);
      await discussionPage.evaluate(() => {
        localStorage.removeItem('__review_capability_threads_v1');
        localStorage.removeItem('__review_capability_writes_v1');
        localStorage.removeItem('__review_capability_clock_v1');
      });
      const changelog = await runDiscussion(discussionPage, server.baseUrl, 'changelog.html', 'cl-',
        'Capability thread on changelog', 'Capability changelog reply');
      const usecase = await runDiscussion(discussionPage, server.baseUrl, 'usecases.html', 'uc-',
        'Capability thread on use case', 'Capability use-case reply');
      assert.notEqual(changelog.threadId, usecase.threadId);

      await goto(discussionPage, server.baseUrl + 'comments.html');
      await discussionPage.waitForFunction(ids => {
        const layer = window.__capabilityLayer;
        return layer && ids.every(id => layer.threads.some(thread => thread.id === id))
          && document.querySelectorAll('#cm-groups .rp-card').length >= ids.length;
      }, { timeout: 15000 }, [changelog.threadId, usecase.threadId]);
      const overview = await discussionPage.evaluate(() => ({
        ids: window.__capabilityLayer.threads.map(thread => thread.id),
        bodies: Array.from(document.querySelectorAll('#cm-groups .rp-body')).map(node => node.textContent.trim()),
        clients: window.__capabilityClientCreations,
      }));
      assert.ok(overview.ids.includes(changelog.threadId) && overview.ids.includes(usecase.threadId));
      assert.ok(overview.bodies.includes('Capability thread on changelog'));
      assert.ok(overview.bodies.includes('Capability thread on use case'));
      assert.equal(overview.clients, 1, 'comments overview uses one injected client over the same fake backend');
      console.log('PASS discussions: stable cl-/uc- targets, start/reply/resolve, same IDs in comments overview');
    } finally {
      await discussionPage.close();
    }

    const { page: signedOutPage } = await newPage(browser, server.baseUrl, { signedOut: true });
    try {
      await goto(signedOutPage, server.baseUrl);
      await signedOutPage.evaluate(() => {
        localStorage.removeItem('__review_capability_threads_v1');
        localStorage.removeItem('__review_capability_writes_v1');
        localStorage.removeItem('__review_capability_clock_v1');
      });
      await goto(signedOutPage, server.baseUrl + 'changelog.html?auth=out&inv=few');
      await waitForDiscussion(signedOutPage);
      const before = await signedOutPage.evaluate(() => Number(localStorage.getItem('__review_capability_writes_v1') || 0));
      const href = await signedOutPage.$eval('.pd-signin a', node => node.href);
      assert.equal(new URL(href).pathname.split('/').pop(), 'comments.html');
      await Promise.all([
        signedOutPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        signedOutPage.click('.pd-signin a'),
      ]);
      assert.equal(new URL(signedOutPage.url()).pathname.split('/').pop(), 'comments.html');
      const after = await signedOutPage.evaluate(() => Number(localStorage.getItem('__review_capability_writes_v1') || 0));
      assert.equal(after, before, 'signed-out affordance performs no write');
      console.log('PASS signed-out path: English comments-page affordance, zero writes');
    } finally {
      await signedOutPage.close();
    }

    for (const file of REVIEW_PAGES) await testFileFallback(browser, file);
    console.log('PASS file:// fallback: readable notices, zero comment initialization or UI side effects');
  } finally {
    await browser.close();
    await server.close();
  }
  console.log('BOUNDARY injected createFirebaseClient only; live Firebase was neither contacted nor verified.');
  console.log('RESULT review capability checks passed');
}

main().catch(error => {
  console.error('FAIL review capability checks');
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
