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
  stateKeys: ['auth', 'session', 'inv', 'density', 'per', 'rooms', 'stf', 'sthome', 'stlist', 'sthotel', 'pin', 'assets'],
};
const COMMENT_STATE = Object.freeze({
  auth: 'in',
  session: 'new',
  inv: 'few',
  density: 'c',
  per: '20',
  rooms: 'off',
  stf: 'off',
  sthome: 'off',
  stlist: 'off',
  sthotel: 'off',
  pin: 'banner',
  assets: 'prod',
});
const ANCHOR_FIELDS = ['page', 'viewport', 'lang', 'state', 'selector', 'selectorKind', 'rx', 'ry', 'label', 'text'];

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

function testPreload(schema, config, testOptions) {
  const options = testOptions || {};
  window.__PROTO_COMMENTS_TESTING__ = true;
  window.__capabilityInitCalls = 0;
  window.__capabilityClientCreations = 0;
  window.__capabilityFacadeCalls = {};
  const THREADS_KEY = '__review_capability_threads_v1';
  const WRITES_KEY = '__review_capability_writes_v1';
  const CLOCK_KEY = '__review_capability_clock_v1';
  const METRICS_KEY = '__review_capability_metrics_v2';
  const trackedListeners = { click: new Set(), keydown: new Set() };
  const nativeAddEventListener = document.addEventListener.bind(document);
  const nativeRemoveEventListener = document.removeEventListener.bind(document);

  document.addEventListener = function (type, listener, eventOptions) {
    if (eventOptions === true && trackedListeners[type]) trackedListeners[type].add(listener);
    return nativeAddEventListener(type, listener, eventOptions);
  };
  document.removeEventListener = function (type, listener, eventOptions) {
    if (eventOptions === true && trackedListeners[type]) trackedListeners[type].delete(listener);
    return nativeRemoveEventListener(type, listener, eventOptions);
  };
  window.__capabilitySelectionListeners = () => ({
    click: trackedListeners.click.size,
    keydown: trackedListeners.keydown.size,
  });

  function readThreads() {
    try { return JSON.parse(localStorage.getItem(THREADS_KEY) || '[]'); }
    catch (error) { return []; }
  }
  function writes() { return Number(localStorage.getItem(WRITES_KEY) || 0); }
  function metrics() {
    try {
      return Object.assign({
        addCalls: 0, addWrites: 0, invalidAdds: 0,
        replyCalls: 0, resolveCalls: 0,
        roleLookups: 0, confirmations: 0,
        deleteCalls: 0, deleteWrites: 0, authoritativeEvents: 0,
        watcherResets: 0,
      }, JSON.parse(localStorage.getItem(METRICS_KEY) || '{}'));
    } catch (error) {
      return {};
    }
  }
  function count(name) {
    const current = metrics();
    current[name] = Number(current[name] || 0) + 1;
    localStorage.setItem(METRICS_KEY, JSON.stringify(current));
    return current[name];
  }
  function timestamp() {
    const previous = Number(localStorage.getItem(CLOCK_KEY) || 0);
    const next = Math.max(Date.now(), previous + 1);
    localStorage.setItem(CLOCK_KEY, String(next));
    return new Date(next).toISOString();
  }
  function saveThreads(threads, subscribers, notify) {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    localStorage.setItem(WRITES_KEY, String(writes() + 1));
    if (notify !== false) subscribers.forEach(callback => callback(readThreads()));
  }
  function fakeClient() {
    window.__capabilityClientCreations += 1;
    const subscribers = new Set();
    const authoritativeObservers = new Set();
    let authObserver = null;
    let failDeleteRemaining = options.failDeleteOnce ? 1 : 0;
    const ownerEmail = 'owner@example.test';
    const ordinaryEmail = 'reviewer@example.test';
    const defaultUser = options.signedOut ? null : {
      uid: options.role === 'owner' ? 'owner-1' : 'reviewer-1',
      displayName: options.role === 'owner' ? 'Capability Owner' : 'Capability Reviewer',
      email: options.role === 'owner' ? ownerEmail : ordinaryEmail,
      emailVerified: options.emailVerified !== false,
    };
    window.__capabilityDefaultUser = defaultUser;
    window.__capabilitySetUser = user => {
      if (authObserver) authObserver(user);
    };
    window.__capabilityMetrics = metrics;
    window.__capabilityReleaseDeletion = threadId => {
      count('authoritativeEvents');
      authoritativeObservers.forEach(observer => observer(threadId));
    };
    const store = {
      list: async () => readThreads(),
      subscribe: callback => { subscribers.add(callback); return () => subscribers.delete(callback); },
      add: async (threadData, messageData) => {
        count('addCalls');
        let anchor;
        try {
          anchor = window.protoComments.__test.validateCommentAnchor(threadData && threadData.anchor);
        } catch (error) {
          count('invalidAdds');
          throw error;
        }
        const threads = readThreads();
        const now = timestamp();
        const thread = Object.assign({}, threadData, { anchor }, {
          id: 'cap-thread-' + (threads.length + 1),
          status: 'open', createdAt: now, updatedAt: now,
          messages: [Object.assign({ id: 'message-1', createdAt: now }, messageData)],
        });
        threads.push(thread);
        saveThreads(threads, subscribers);
        count('addWrites');
        return thread.id;
      },
      reply: async (id, messageData) => {
        count('replyCalls');
        const threads = readThreads();
        const thread = threads.find(item => item.id === id);
        if (!thread) throw new Error('FAKE_CLIENT_REPLY_TARGET_MISSING');
        if (thread.status === 'deleting') throw new Error('COMMENTS_THREAD_DELETING');
        const now = timestamp();
        thread.messages.push(Object.assign({ id: 'message-' + (thread.messages.length + 1), createdAt: now }, messageData));
        thread.updatedAt = now;
        saveThreads(threads, subscribers);
      },
      resolve: async (id, reviewer) => {
        count('resolveCalls');
        const threads = readThreads();
        const thread = threads.find(item => item.id === id);
        if (!thread) throw new Error('FAKE_CLIENT_RESOLVE_TARGET_MISSING');
        if (thread.status === 'deleting') throw new Error('COMMENTS_THREAD_DELETING');
        const now = timestamp();
        Object.assign(thread, { status: 'resolved', resolvedAt: now, resolvedBy: reviewer, updatedAt: now });
        saveThreads(threads, subscribers);
      },
    };
    const capabilities = {
      hasNextPage: () => false,
      loadNextPage: async () => [],
      loadThreadDetail: async threadId => readThreads().find(thread => thread.id === threadId) || null,
      readOwnerRole: async user => {
        count('roleLookups');
        if (options.roleDelayMs) await new Promise(resolve => setTimeout(resolve, options.roleDelayMs));
        return Boolean(user && user.emailVerified === true && user.email === ownerEmail && options.role === 'owner');
      },
      deleteThread: async threadId => {
        count('deleteCalls');
        const threads = readThreads();
        const index = threads.findIndex(thread => thread.id === threadId);
        if (index === -1) return { state: 'already-deleted' };
        if (threads[index].status !== 'deleting') {
          threads[index].status = 'deleting';
          threads[index].updatedAt = timestamp();
          saveThreads(threads, subscribers);
          count('deleteWrites');
        }
        if (failDeleteRemaining > 0) {
          failDeleteRemaining -= 1;
          throw new Error('FAKE_DELETE_INTERRUPTED');
        }
        const remaining = readThreads().filter(thread => thread.id !== threadId);
        saveThreads(remaining, subscribers, false);
        count('deleteWrites');
        return { state: 'awaiting-authoritative-snapshot' };
      },
      subscribeAuthoritative: observer => {
        authoritativeObservers.add(observer);
        return () => authoritativeObservers.delete(observer);
      },
      resetThreadWatchers: () => count('watcherResets'),
      setOrphaned: async (threadId, orphaned) => {
        const threads = readThreads();
        const thread = threads.find(item => item.id === threadId);
        if (!thread) return;
        thread.orphaned = Boolean(orphaned);
        saveThreads(threads, subscribers);
      },
    };
    const client = {
      store,
      capabilities,
      observeUser: callback => {
        authObserver = callback;
        callback(defaultUser);
        return () => { if (authObserver === callback) authObserver = null; };
      },
      signIn: async () => null,
    };
    window.__capabilityClient = client;
    return client;
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
          confirmDelete: message => {
            count('confirmations');
            window.__capabilityLastConfirmation = message;
            return options.confirmDelete !== false;
          },
        });
        if (layer) {
          ['threadsAt', 'loadDetail', 'startThread', 'replyTo', 'resolveThread',
            'canDelete', 'deleteThread', 'onCapabilitiesChanged'].forEach(name => {
            if (typeof layer[name] !== 'function') return;
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
  await page.evaluateOnNewDocument(testPreload, SCHEMA, CONFIG, options || {});
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

function commentStateQuery() {
  return new URLSearchParams(COMMENT_STATE).toString();
}

async function resetFakeBackend(page) {
  await page.evaluate(() => {
    localStorage.removeItem('__review_capability_threads_v1');
    localStorage.removeItem('__review_capability_writes_v1');
    localStorage.removeItem('__review_capability_clock_v1');
    localStorage.removeItem('__review_capability_metrics_v2');
  });
}

async function waitForLayer(page, owner) {
  await page.waitForFunction(expectedOwner => {
    const layer = window.__capabilityLayer;
    return Boolean(layer && layer.user && layer.ownerResolved && layer.owner === expectedOwner);
  }, { timeout: 15000 }, Boolean(owner));
}

async function selectionEvidence(page) {
  return page.evaluate(() => ({
    active: document.body.dataset.commenting === '1',
    prompt: Boolean(document.querySelector('.proto-comments-selection:not([hidden])')),
    textarea: document.querySelectorAll('.proto-comments-popover textarea').length,
    post: Array.from(document.querySelectorAll('.proto-comments-popover button'))
      .filter(button => /post comment/i.test(button.textContent)).length,
    listeners: window.__capabilitySelectionListeners(),
    metrics: window.__capabilityMetrics(),
    writes: Number(localStorage.getItem('__review_capability_writes_v1') || 0),
  }));
}

async function assertSelectionClean(page, baseline, label) {
  const state = await selectionEvidence(page);
  assert.equal(state.active, false, label + ' clears body selection state');
  assert.equal(state.prompt, false, label + ' hides target-selection guidance');
  assert.equal(state.listeners.click, baseline.click, label + ' removes the click listener');
  assert.equal(state.listeners.keydown, baseline.keydown, label + ' removes the keyboard listener');
}

async function testScreenAuthoring(browser, baseUrl, file, viewport) {
  const { page } = await newPage(browser, baseUrl, { role: 'ordinary' });
  await page.setViewport(viewport === 'mobile'
    ? { width: 390, height: 844, deviceScaleFactor: 1 }
    : { width: 1440, height: 900, deviceScaleFactor: 1 });
  try {
    await goto(page, baseUrl);
    await resetFakeBackend(page);
    await goto(page, baseUrl + file + '?' + commentStateQuery());
    await waitForLayer(page, false);
    await page.waitForFunction(() => {
      const add = document.querySelector('.pc-add');
      return add && !add.disabled;
    }, { timeout: 15000 });

    const baseline = await page.evaluate(() => window.__capabilitySelectionListeners());
    const initial = await selectionEvidence(page);
    const invalid = await page.evaluate(async () => {
      const before = window.__capabilityMetrics();
      const writesBefore = Number(localStorage.getItem('__review_capability_writes_v1') || 0);
      let code = '';
      try {
        await window.__capabilityClient.store.add(
          { createdBy: {}, anchor: null },
          { author: {}, body: 'invalid anchor must not persist', agent: false },
        );
      } catch (error) {
        code = error && error.message || String(error);
      }
      return {
        before,
        after: window.__capabilityMetrics(),
        writesBefore,
        writesAfter: Number(localStorage.getItem('__review_capability_writes_v1') || 0),
        code,
      };
    });
    assert.match(invalid.code, /COMMENTS_ANCHOR_INVALID/, file + ' rejects a null anchor');
    assert.equal(invalid.after.addCalls, invalid.before.addCalls + 1, file + ' counts the invalid create attempt');
    assert.equal(invalid.after.invalidAdds, invalid.before.invalidAdds + 1, file + ' classifies the invalid create attempt');
    assert.equal(invalid.after.addWrites, invalid.before.addWrites, file + ' performs no invalid create write');
    assert.equal(invalid.writesAfter, invalid.writesBefore, file + ' leaves backend writes unchanged for a null anchor');

    await page.click('.pc-add');
    let selecting = await selectionEvidence(page);
    assert.equal(selecting.active, true, file + ' enters target-selection mode');
    assert.equal(selecting.prompt, true, file + ' shows explicit target-selection guidance');
    assert.equal(selecting.textarea, 0, file + ' exposes no textarea before a target');
    assert.equal(selecting.post, 0, file + ' exposes no Post control before a target');
    assert.equal(selecting.metrics.addWrites, initial.metrics.addWrites, file + ' writes nothing on entry');
    assert.deepEqual(selecting.listeners, { click: baseline.click + 1, keydown: baseline.keydown + 1 },
      file + ' installs exactly one selection listener pair');
    const demoChromeHidden = await page.$eval('.proto-tools', node => getComputedStyle(node).display === 'none');
    assert.equal(demoChromeHidden, true, file + ' hides demo-panel chrome while selecting a product target');

    await page.evaluate(() => {
      const chrome = document.querySelector('.proto-tools .pt-h');
      chrome.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    selecting = await selectionEvidence(page);
    assert.equal(selecting.active, true, file + ' ignores demo-panel chrome as a target');
    assert.equal(selecting.textarea, 0, file + ' demo-panel chrome cannot open a composer');
    assert.equal(selecting.metrics.addWrites, initial.metrics.addWrites, file + ' demo-panel chrome writes nothing');

    await page.click('.proto-comments-selection strong');
    selecting = await selectionEvidence(page);
    assert.equal(selecting.active, true, file + ' ignores comment chrome as a target');
    assert.equal(selecting.textarea, 0, file + ' comment chrome cannot open a composer');
    assert.equal(selecting.metrics.addWrites, initial.metrics.addWrites, file + ' comment chrome writes nothing');
    await page.click('.pc-cancel-selection');
    await assertSelectionClean(page, baseline, file + ' Cancel');

    await page.click('.pc-add');
    await page.keyboard.press('Escape');
    await assertSelectionClean(page, baseline, file + ' Escape');

    await page.click('.pc-add');
    await page.click('.pc-add');
    selecting = await selectionEvidence(page);
    assert.deepEqual(selecting.listeners, { click: baseline.click + 1, keydown: baseline.keydown + 1 },
      file + ' repeated entry replaces rather than accumulates listeners');
    await page.click('.pc-cancel-selection');
    await assertSelectionClean(page, baseline, file + ' repeated-entry Cancel');

    await page.click('.pc-add');
    await page.evaluate(() => window.__capabilitySetUser(null));
    await assertSelectionClean(page, baseline, file + ' sign-out');
    await page.evaluate(() => window.__capabilitySetUser(window.__capabilityDefaultUser));
    await waitForLayer(page, false);

    await page.click('.pc-add');
    await page.evaluate(() => window.__capabilityLayer.showError('Injected selection error', new Error('TEST_ONLY')));
    await assertSelectionClean(page, baseline, file + ' error path');
    const afterExits = await selectionEvidence(page);
    assert.equal(afterExits.metrics.addCalls, invalid.after.addCalls,
      file + ' Cancel, Escape, re-entry, sign-out and error paths make zero create calls');
    assert.equal(afterExits.metrics.addWrites, invalid.after.addWrites,
      file + ' cancellation paths make zero create writes');

    await page.$eval('.search-hero', (node, marker) => node.setAttribute('data-c', marker), 'screen-comment-' + file);
    await page.click('.pc-add');
    const targetPoint = await page.$eval('.search-hero h1', target => {
      target.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = target.getBoundingClientRect();
      const fractions = [0.12, 0.28, 0.5, 0.72, 0.88];
      for (const yFraction of fractions) {
        for (const xFraction of fractions) {
          const x = rect.left + rect.width * xFraction;
          const y = rect.top + rect.height * yFraction;
          const top = document.elementFromPoint(x, y);
          if (top === target || target.contains(top)) return { x, y };
        }
      }
      return null;
    });
    assert.ok(targetPoint, file + ' exposes a real product point for comment authoring');
    await page.mouse.click(targetPoint.x, targetPoint.y);
    await page.waitForSelector('.proto-comments-popover textarea', { visible: true, timeout: 10000 });
    const composed = await selectionEvidence(page);
    assert.equal(composed.active, false, file + ' captures the target before composing');
    assert.equal(composed.prompt, false, file + ' hides guidance after a valid target');
    assert.equal(composed.textarea, 1, file + ' exposes one composer after a valid target');
    assert.equal(composed.post, 1, file + ' exposes one Post control after a valid target');

    const body = 'Screen comment on ' + file;
    await page.type('.proto-comments-popover textarea', body);
    await page.click('.proto-comments-popover footer button');
    await page.waitForFunction(expectedBody => {
      const threads = JSON.parse(localStorage.getItem('__review_capability_threads_v1') || '[]');
      return threads.length === 1 && threads[0].messages[0].body === expectedBody;
    }, { timeout: 10000 }, body);
    const created = await page.evaluate(() => {
      const threads = JSON.parse(localStorage.getItem('__review_capability_threads_v1') || '[]');
      return { thread: threads[0], metrics: window.__capabilityMetrics() };
    });
    assert.equal(created.metrics.addCalls, invalid.after.addCalls + 1, file + ' makes one valid create call');
    assert.equal(created.metrics.addWrites, invalid.after.addWrites + 1, file + ' persists one valid create');
    assert.equal(created.metrics.invalidAdds, invalid.after.invalidAdds, file + ' does not misclassify the valid create');
    assert.deepEqual(Object.keys(created.thread.anchor).sort(), ANCHOR_FIELDS.slice().sort(),
      file + ' persists the exact ten-field anchor');
    assert.equal(created.thread.anchor.page.endsWith('/' + file), true, file + ' anchors to the full page path');
    assert.equal(created.thread.anchor.viewport, viewport, file + ' records the correct viewport');
    assert.equal(created.thread.anchor.lang, 'ro', file + ' records the screen language');
    assert.deepEqual(created.thread.anchor.state, COMMENT_STATE, file + ' captures all twelve workshop state axes');
    assert.equal(created.thread.anchor.selectorKind, 'data');
    const selectedMarker = await page.evaluate(selector => {
      const target = document.querySelector(selector);
      return target && target.getAttribute('data-c');
    }, created.thread.anchor.selector);
    assert.equal(selectedMarker, 'screen-comment-' + file,
      file + ' prefers the nearest stable data-c marker');
    assert.ok(Number.isFinite(created.thread.anchor.rx) && created.thread.anchor.rx >= 0 && created.thread.anchor.rx <= 1);
    assert.ok(Number.isFinite(created.thread.anchor.ry) && created.thread.anchor.ry >= 0 && created.thread.anchor.ry <= 1);

    const deepLink = await page.evaluate(threadId => {
      const thread = window.__capabilityLayer.threads.find(item => item.id === threadId);
      return window.__capabilityLayer.deepLink(thread).href;
    }, created.thread.id);
    const deepUrl = new URL(deepLink);
    Object.entries(COMMENT_STATE).forEach(([key, value]) => {
      assert.equal(deepUrl.searchParams.get(key), value, file + ' deep link carries ' + key);
    });
    assert.equal(deepUrl.searchParams.get('viewport'), viewport);
    assert.equal(deepUrl.searchParams.get('lang'), 'ro');
    deepUrl.hash = '';
    await goto(page, deepUrl.href);
    await waitForLayer(page, false);
    const restored = await page.evaluate(keys => Object.fromEntries(
      keys.map(key => [key, document.body.dataset[key]]),
    ), Object.keys(COMMENT_STATE));
    assert.deepEqual(restored, COMMENT_STATE, file + ' restores all twelve axes before target navigation');

    const teardownBaseline = await page.evaluate(() => window.__capabilitySelectionListeners());
    await page.click('.pc-add');
    await page.evaluate(() => window.__capabilityLayer.destroy());
    await assertSelectionClean(page, teardownBaseline, file + ' teardown');
    return created.thread.id;
  } finally {
    await page.close();
  }
}

async function testRoleChangeGuard(browser, baseUrl) {
  const { page } = await newPage(browser, baseUrl, { role: 'owner', roleDelayMs: 80 });
  try {
    await goto(page, baseUrl + 'm-home.html?' + commentStateQuery());
    await page.waitForFunction(() => window.__capabilityLayer && window.__capabilitySetUser, { timeout: 15000 });
    await page.evaluate(() => window.__capabilitySetUser({
      uid: 'reviewer-2', displayName: 'Changed Reviewer',
      email: 'reviewer@example.test', emailVerified: true,
    }));
    await waitForLayer(page, false);
    const capability = await page.evaluate(() => ({
      owner: window.__capabilityLayer.owner,
      resolved: window.__capabilityLayer.ownerResolved,
      lookups: window.__capabilityMetrics().roleLookups,
    }));
    assert.equal(capability.owner, false, 'a stale owner lookup cannot leak across an account change');
    assert.equal(capability.resolved, true);
    assert.ok(capability.lookups >= 2, 'both account generations perform explicit role lookup');
  } finally {
    await page.close();
  }
}

async function testDeletionCapabilities(browser, baseUrl, threadId) {
  const ordinary = await newPage(browser, baseUrl, { role: 'ordinary' });
  try {
    await goto(ordinary.page, baseUrl + 'm-home.html?' + commentStateQuery());
    await waitForLayer(ordinary.page, false);
    await ordinary.page.waitForFunction(id => window.__capabilityLayer.threads.some(thread => thread.id === id),
      { timeout: 15000 }, threadId);
    const denial = await ordinary.page.evaluate(async id => {
      const layer = window.__capabilityLayer;
      const thread = layer.threads.find(item => item.id === id);
      layer.showComposer(thread);
      const before = window.__capabilityMetrics();
      let code = '';
      try { await layer.deleteThread(thread); }
      catch (error) { code = error && error.message || String(error); }
      return {
        canDelete: layer.canDelete(thread),
        controls: document.querySelectorAll('.pc-delete').length,
        before,
        after: window.__capabilityMetrics(),
        code,
      };
    }, threadId);
    assert.equal(denial.canDelete, false, 'ordinary reviewers have no delete capability');
    assert.equal(denial.controls, 0, 'ordinary reviewers receive no delete control');
    assert.match(denial.code, /COMMENTS_DELETE_FORBIDDEN/);
    assert.equal(denial.after.confirmations, denial.before.confirmations, 'ordinary denial does not ask for confirmation');
    assert.equal(denial.after.deleteCalls, denial.before.deleteCalls, 'ordinary denial never reaches the delete seam');
  } finally {
    await ordinary.page.close();
  }

  const owner = await newPage(browser, baseUrl, { role: 'owner', confirmDelete: true, failDeleteOnce: true });
  try {
    await goto(owner.page, baseUrl + 'm-home.html?' + commentStateQuery());
    await waitForLayer(owner.page, true);
    await owner.page.waitForFunction(id => window.__capabilityLayer.threads.some(thread => thread.id === id),
      { timeout: 15000 }, threadId);
    const snapshotGuard = await owner.page.evaluate(() => {
      const isAuthoritative = window.protoComments.__test.isAuthoritativeDeletionSnapshot;
      return {
        pendingDelete: isAuthoritative({
          exists: () => false,
          metadata: { hasPendingWrites: true },
        }),
        confirmedDelete: isAuthoritative({
          exists: () => false,
          metadata: { hasPendingWrites: false, fromCache: false },
        }),
        cachedMiss: isAuthoritative({
          exists: () => false,
          metadata: { hasPendingWrites: false, fromCache: true },
        }),
        existingDocument: isAuthoritative({
          exists: () => true,
          metadata: { hasPendingWrites: false, fromCache: false },
        }),
      };
    });
    assert.deepEqual(snapshotGuard, {
      pendingDelete: false,
      confirmedDelete: true,
      cachedMiss: false,
      existingDocument: false,
    }, 'only a server-confirmed missing document is authoritative for UI removal');
    const ownerControl = await owner.page.evaluate(id => {
      const layer = window.__capabilityLayer;
      const thread = layer.threads.find(item => item.id === id);
      layer.showComposer(thread);
      return { canDelete: layer.canDelete(thread), controls: document.querySelectorAll('.pc-delete').length };
    }, threadId);
    assert.equal(ownerControl.canDelete, true, 'verified allowlisted owner receives delete capability');
    assert.equal(ownerControl.controls, 1, 'owner receives one delete control');

    const first = await owner.page.evaluate(async id => {
      const layer = window.__capabilityLayer;
      const thread = layer.threads.find(item => item.id === id);
      let code = '';
      try { await layer.deleteThread(thread); }
      catch (error) { code = error && error.message || String(error); }
      const current = layer.threads.find(item => item.id === id);
      return {
        code,
        status: current && current.status,
        canRetry: layer.canDelete(current),
        metrics: window.__capabilityMetrics(),
        textarea: document.querySelectorAll('.proto-comments-popover textarea').length,
        resolve: document.querySelectorAll('.pc-resolve').length,
      };
    }, threadId);
    assert.match(first.code, /FAKE_DELETE_INTERRUPTED/, 'partial deletion exposes its failure');
    assert.equal(first.status, 'deleting', 'failed deletion retains the persisted deleting state');
    assert.equal(first.canRetry, true, 'owner can retry a deleting thread');
    assert.equal(first.textarea, 0, 'deleting thread is read-only');
    assert.equal(first.resolve, 0, 'deleting thread cannot be resolved');

    const readOnly = await owner.page.evaluate(async id => {
      const layer = window.__capabilityLayer;
      const thread = layer.threads.find(item => item.id === id);
      const before = window.__capabilityMetrics();
      const errors = [];
      try { await layer.replyTo(thread, 'must fail'); } catch (error) { errors.push(error.message); }
      try { await layer.resolveThread(thread); } catch (error) { errors.push(error.message); }
      return { before, after: window.__capabilityMetrics(), errors };
    }, threadId);
    assert.deepEqual(readOnly.errors, ['COMMENTS_THREAD_DELETING', 'COMMENTS_THREAD_DELETING']);
    assert.equal(readOnly.after.replyCalls, readOnly.before.replyCalls, 'read-only guard blocks reply before storage');
    assert.equal(readOnly.after.resolveCalls, readOnly.before.resolveCalls, 'read-only guard blocks resolve before storage');

    const retry = await owner.page.evaluate(async id => {
      const layer = window.__capabilityLayer;
      await layer.deleteThread(layer.threads.find(item => item.id === id));
      return {
        retained: layer.threads.some(item => item.id === id),
        stored: JSON.parse(localStorage.getItem('__review_capability_threads_v1') || '[]').some(item => item.id === id),
        metrics: window.__capabilityMetrics(),
      };
    }, threadId);
    assert.equal(retry.retained, true, 'request completion alone does not remove local UI');
    assert.equal(retry.stored, false, 'retry completes backend removal');
    assert.equal(retry.metrics.confirmations, first.metrics.confirmations, 'retrying deleting state does not reconfirm');
    assert.equal(retry.metrics.deleteCalls, first.metrics.deleteCalls + 1, 'retry reaches the same delete seam once');

    await owner.page.evaluate(id => window.__capabilityReleaseDeletion(id), threadId);
    await owner.page.waitForFunction(id => !window.__capabilityLayer.threads.some(thread => thread.id === id),
      { timeout: 10000 }, threadId);
    const final = await owner.page.evaluate(async id => ({
      result: await window.__capabilityClient.capabilities.deleteThread(id),
      metrics: window.__capabilityMetrics(),
    }), threadId);
    assert.equal(final.result.state, 'already-deleted', 'an already absent thread is idempotent success');
    assert.ok(final.metrics.authoritativeEvents >= 1, 'authoritative disappearance drives final UI removal');
  } finally {
    await owner.page.close();
  }
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
  const rules = fs.readFileSync(path.join(ROOT, 'comments.rules'), 'utf8');
  const boot = fs.readFileSync(path.join(ROOT, 'proto-comments-boot.js'), 'utf8');
  const activeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'comments.config.json'), 'utf8'));
  const exampleConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'comments.config.example.json'), 'utf8'));
  const configSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'comments.config.schema.json'), 'utf8'));
  const usecases = fs.readFileSync(path.join(ROOT, 'usecases.html'), 'utf8');
  const reviewerFiles = ['index.html', 'changelog.html', 'usecases.html', 'comments.html',
    'proto-sheets.js', 'proto-discussion.js', 'proto-comments.js'];
  assert.equal(/\bfetch\s*\(/.test(sheets), false, 'panel navigation owns no fetch path');
  assert.equal(/pt-sheet(?:-toggle|-body)?/.test(sheets), false, 'panel navigation owns no preview sheet path');
  assert.equal(/firebase|firestore|createFirebaseClient|commentsStore/i.test(discussion), false,
    'discussion module contains no backend/client implementation');
  const layerMembers = [...discussion.matchAll(/layer\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]);
  assert.ok(layerMembers.length > 0, 'discussion module uses a comment-layer facade');
  const allowed = new Set(['threadsAt', 'loadDetail', 'startThread', 'replyTo', 'resolveThread',
    'canDelete', 'deleteThread', 'onCapabilitiesChanged', 'user', 'threadsDelivered']);
  assert.deepEqual([...new Set(layerMembers.filter(name => !allowed.has(name)))], [],
    'discussion module uses only the shared layer facade and its read-only state');
  ['threadsAt', 'loadDetail', 'startThread', 'replyTo', 'resolveThread',
    'canDelete', 'deleteThread', 'onCapabilitiesChanged'].forEach(name => {
    assert.match(comments, new RegExp('\\b' + name + '\\s*\\('), 'shared layer exposes ' + name);
  });
  assert.deepEqual(activeConfig.stateKeys, Object.keys(COMMENT_STATE),
    'active comment config carries the complete twelve-axis state register');
  assert.deepEqual(exampleConfig.stateKeys, activeConfig.stateKeys,
    'example comment config carries the same active twelve-axis state register');
  assert.equal(Object.prototype.hasOwnProperty.call(exampleConfig, 'allowedEmailDomains'), false,
    'example comment config contains no dead domain allowlist');
  assert.equal(Object.prototype.hasOwnProperty.call(configSchema.properties, 'allowedEmailDomains'), false,
    'comment config schema contains no dead domain allowlist');
  [exampleConfig, activeConfig].forEach((candidate, index) => {
    assert.deepEqual(Object.keys(candidate).filter(key => !configSchema.properties[key]), [],
      (index ? 'active' : 'example') + ' config contains only runtime schema fields');
    configSchema.required.forEach(key => assert.ok(Object.prototype.hasOwnProperty.call(candidate, key),
      (index ? 'active' : 'example') + ' config contains required ' + key));
    assert.deepEqual(Object.keys(candidate.firebase).filter(key => !configSchema.properties.firebase.properties[key]), [],
      (index ? 'active' : 'example') + ' Firebase config contains only runtime schema fields');
  });
  assert.match(boot, /allowed\/\{verified-email\}/,
    'startup documentation provisions reviewers through exact allowlist records');
  assert.match(boot, /user: "owner"/, 'startup documentation names the owner-only provisioning field');
  assert.match(comments, /const ANCHOR_FIELDS = Object\.freeze\(\[[\s\S]*?'text',[\s\S]*?\]\);/,
    'browser layer owns one explicit ten-field anchor contract');
  assert.match(comments, /const DELETE_BATCH_SIZE = 400;/,
    'owner deletion keeps message batches below the Firestore write limit');
  assert.match(comments, /readOwnerRole:[\s\S]*?emailVerified !== true[\s\S]*?allowed[\s\S]*?user === 'owner'/,
    'owner capability comes from the verified account exact allowlist record');
  assert.match(comments, /status: 'deleting'/, 'browser deletion persists the read-only deleting state');
  assert.match(comments, /subscribeAuthoritative/, 'browser deletion exposes authoritative document disappearance');
  assert.match(comments, /includeMetadataChanges: true/,
    'authoritative deletion watcher receives metadata changes');
  assert.match(comments, /metadata\.hasPendingWrites !== true/,
    'authoritative deletion ignores locally pending snapshots');
  assert.match(comments, /metadata\.fromCache !== true/,
    'authoritative deletion ignores cache-only missing snapshots');
  assert.match(rules, /function signedInWithEmail\(\)[\s\S]*?email_verified == true/,
    'Firestore reviewer identity requires a verified email');
  assert.match(rules, /function owner\(\)[\s\S]*?signedInWithEmail\(\)[\s\S]*?allowed\/\$\(request\.auth\.token\.email\)[\s\S]*?data\.user == 'owner'/,
    'Firestore owner authorization is exact-record only');
  ANCHOR_FIELDS.forEach(field => assert.match(rules, new RegExp("'" + field + "'"),
    'Firestore anchor contract includes ' + field));
  assert.match(rules, /allow update: if owner\(\)[\s\S]*?request\.resource\.data\.status == 'deleting'/,
    'Firestore rules permit only the owner transition into deleting');
  assert.match(rules, /allow delete: if owner\(\) && resource\.data\.status == 'deleting'/,
    'Firestore parent deletion requires owner and persisted deleting state');
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/package.json'), 'utf8'));
  assert.equal(packageJson.scripts && packageJson.scripts['test:review'], 'node test-review-capabilities.js',
    'tools package exposes the focused review entry point');
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/prototype-refresh.yml'), 'utf8');
  assert.ok(workflow.indexOf('npm --prefix tools run test:review') >= 0,
    'Pages workflow runs the focused review entry point');
  assert.ok(workflow.indexOf('npm --prefix tools run test:review') < workflow.indexOf('node tools/refresh.js'),
    'Pages verifies review capabilities before refreshing artifacts');
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
  console.log('PASS static contracts: one comment facade, twelve state axes, focused Pages guard, English reviewer chrome');
  if (process.argv.includes('--static')) {
    console.log('BOUNDARY static source assertions only; no server, browser or live Firebase was started.');
    console.log('RESULT static review capability checks passed');
    return;
  }
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

    await testScreenAuthoring(browser, server.baseUrl, 'home-c.html', 'desktop');
    const mobileThreadId = await testScreenAuthoring(browser, server.baseUrl, 'm-home.html', 'mobile');
    console.log('PASS screen comments: desktop/mobile anchor-first authoring, cleanup exits, exact anchors and state restoration');

    await testRoleChangeGuard(browser, server.baseUrl);
    await testDeletionCapabilities(browser, server.baseUrl, mobileThreadId);
    console.log('PASS owner lifecycle: stale-role guard, ordinary denial, deleting retry/read-only state and authoritative removal');

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
