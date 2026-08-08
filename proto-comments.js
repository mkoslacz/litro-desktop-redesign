/* ============================================================
   Prototype · stakeholder comments
   ------------------------------------------------------------
   This is deliberately a second, opt-in IIFE beside proto-tools.
   Publish comments.config.json and comments.config.schema.json, then load
   proto-tools.js and this file after protoTools.init(...). A prototype with no
   config keeps behaving
   as a plain, file://-openable static page.

   The browser store deliberately exposes a small operations surface:
   list, subscribe, add, reply and resolve. Complete deletion stays behind
   the layer's owner capability instead of becoming a caller-supplied role.
   implementation; replacing createFirebaseClient is the swap seam.
   ============================================================ */
(function (global) {
  'use strict';

  const qp = new URLSearchParams(location.search);
  const EXPORT = qp.has('nopanel');
  const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const COMMENTS_CONFIG_FILE = 'comments.config.json';
  const COMMENTS_CONFIG_SCHEMA_FILE = 'comments.config.schema.json';
  const OVERVIEW_PAGE = 'comments.html';
  const THREAD_PAGE_SIZE = 50;
  const DETAIL_CONCURRENCY = 4;
  const DELETE_BATCH_SIZE = 400;
  // Review controls are not product surfaces. A click on them must leave
  // selection active instead of creating a brittle anchor to the control.
  const COMMENT_SELECTION_CHROME = [
    '.proto-comments-tools',
    '.proto-comments-tray',
    '.proto-comments-popover',
    '.proto-comments-selection',
    '.proto-comment-pin',
    '.pd-discussion',
    '.proto-tools',
    '.proto-rail',
    '.invdemo',
    '.vswitch',
  ].join(', ');
  const ANCHOR_FIELDS = Object.freeze([
    'page', 'viewport', 'lang', 'state', 'selector', 'selectorKind', 'rx', 'ry', 'label', 'text',
  ]);
  const ANCHOR_LIMITS = Object.freeze({
    label: 240,
    lang: 35,
    page: 512,
    selector: 1024,
    stateEntries: 32,
    stateKey: 64,
    stateValue: 512,
    text: 4000,
  });
  const STORE_PRIVATE = new WeakMap();
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function note(message) {
    // A single, quiet line is intentional: absent configuration is normal.
    if (global.console && global.console.info) global.console.info('[proto-comments] ' + message);
  }

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function iso(value) {
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    return value || new Date().toISOString();
  }

  function actor(user) {
    return {
      uid: user && user.uid || 'unknown',
      name: user && (user.displayName || user.email) || 'Unknown reviewer',
      email: user && user.email || '',
    };
  }

  function optionBag(input) {
    if (!input) return {};
    // Every recognised key has to be listed here: an option bag naming none of
    // them is read as a bare config object, so a new option added without a
    // line here silently becomes configuration and never reaches the layer.
    if (input.config || input.schema || input.store || input.user || input.signIn || input.fetchConfig || input.configUrl || input.schemaUrl || input.createFirebaseClient || input.overview || input.confirmDelete || input.capabilities) return input;
    return { config: input };
  }

  function configError(detail) {
    throw new Error('COMMENTS_CONFIG_INVALID: ' + detail);
  }

  function schemaError(detail) {
    throw new Error('COMMENTS_CONFIG_SCHEMA_INVALID: ' + detail);
  }

  function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function anchorError(detail) {
    throw new Error('COMMENTS_ANCHOR_INVALID: ' + detail);
  }

  function boundedAnchorString(value, field, limit, required) {
    if (typeof value !== 'string') anchorError(field + ' must be a string.');
    const normalized = required ? value.trim() : value;
    if (required && !normalized) anchorError(field + ' must be non-empty.');
    if (normalized.length > limit) anchorError(field + ' exceeds ' + limit + ' characters.');
    return normalized;
  }

  /* The Rules-enforceable core is the exact top-level shape, bounded strings,
     enum values, a bounded map and finite in-range coordinates. Rules cannot
     universally type-check values under dynamic map keys, so this trusted
     boundary deliberately adds the state key/value string contract. */
  function validateCommentAnchor(value) {
    if (!plainObject(value)) anchorError('anchor must be an object.');
    const keys = Object.keys(value);
    if (keys.length !== ANCHOR_FIELDS.length || keys.some(key => ANCHOR_FIELDS.indexOf(key) === -1)) {
      anchorError('anchor must contain exactly the canonical fields.');
    }
    if (!plainObject(value.state)) anchorError('state must be an object.');
    const stateKeys = Object.keys(value.state);
    if (stateKeys.length > ANCHOR_LIMITS.stateEntries) anchorError('state has too many entries.');
    const state = {};
    stateKeys.forEach(key => {
      if (!key || key.length > ANCHOR_LIMITS.stateKey) {
        anchorError('state keys must be bounded non-empty strings.');
      }
      state[key] = boundedAnchorString(value.state[key], 'state.' + key, ANCHOR_LIMITS.stateValue, false);
    });
    if (!Number.isFinite(value.rx) || value.rx < 0 || value.rx > 1) {
      anchorError('rx must be a finite number in 0..1.');
    }
    if (!Number.isFinite(value.ry) || value.ry < 0 || value.ry > 1) {
      anchorError('ry must be a finite number in 0..1.');
    }
    if (['desktop', 'mobile'].indexOf(value.viewport) === -1) {
      anchorError('viewport must be desktop or mobile.');
    }
    if (['data', 'id', 'path'].indexOf(value.selectorKind) === -1) {
      anchorError('selectorKind must be data, id, or path.');
    }
    return {
      page: boundedAnchorString(value.page, 'page', ANCHOR_LIMITS.page, true),
      viewport: value.viewport,
      lang: boundedAnchorString(value.lang, 'lang', ANCHOR_LIMITS.lang, true),
      state,
      selector: boundedAnchorString(value.selector, 'selector', ANCHOR_LIMITS.selector, true),
      selectorKind: value.selectorKind,
      rx: value.rx,
      ry: value.ry,
      label: boundedAnchorString(value.label, 'label', ANCHOR_LIMITS.label, true),
      text: boundedAnchorString(value.text, 'text', ANCHOR_LIMITS.text, false),
    };
  }

  function readableAnchorState(anchor) {
    const source = plainObject(anchor && anchor.state) ? anchor.state : {};
    return Object.keys(source).reduce((result, key) => {
      if (typeof source[key] === 'string') result[key] = source[key];
      return result;
    }, {});
  }

  function schemaObject(schema, label) {
    if (!plainObject(schema)) schemaError(label + ' must be an object.');
    return schema;
  }

  function schemaProperties(schema, label) {
    const objectSchema = schemaObject(schema, label);
    if (objectSchema.type !== 'object' || !plainObject(objectSchema.properties)) {
      schemaError(label + ' must declare an object with properties.');
    }
    if (objectSchema.additionalProperties !== false) schemaError(label + ' must reject additional properties.');
    if (objectSchema.required != null && !Array.isArray(objectSchema.required)) schemaError(label + '.required must be an array.');
    return objectSchema;
  }

  function validateConfigValue(value, schema, label) {
    const rule = schemaObject(schema, label + ' schema');
    if (rule.type === 'string') {
      if (typeof value !== 'string') configError(label + ' must be a string.');
      const normalized = value.trim();
      if (rule.minLength && normalized.length < rule.minLength) configError(label + ' must be a non-empty string.');
      if (rule.format === 'http-url-without-credentials') {
        try {
          const parsed = new URL(normalized);
          if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            configError(label + ' must be an http(s) URL without credentials.');
          }
        } catch (error) {
          configError(label + ' must be an http(s) URL without credentials.');
        }
      }
      return normalized;
    }

    if (rule.type === 'array') {
      if (!Array.isArray(value)) configError(label + ' must be an array.');
      if (rule.minItems && value.length < rule.minItems) configError(label + ' must not be empty.');
      const items = value.map((item, index) => validateConfigValue(item, rule.items, label + '[' + index + ']'));
      if (rule.uniqueItems && new Set(items.map(item => JSON.stringify(item))).size !== items.length) {
        configError(label + ' must not contain duplicates.');
      }
      return items;
    }

    if (rule.type === 'object') {
      const objectSchema = schemaProperties(rule, label + ' schema');
      if (!plainObject(value)) configError(label + ' must be an object.');
      const properties = objectSchema.properties;
      Object.keys(value).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) configError(label + '.' + key + ' is not allowed.');
      });
      const required = new Set(objectSchema.required || []);
      required.forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) schemaError(label + ' schema requires undeclared ' + key + '.');
      });
      const result = {};
      Object.entries(properties).forEach(([key, propertySchema]) => {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = validateConfigValue(value[key], propertySchema, label + '.' + key);
        } else if (required.has(key)) {
          result[key] = validateConfigValue(undefined, propertySchema, label + '.' + key);
        }
      });
      return result;
    }

    schemaError(label + ' schema has unsupported type ' + String(rule.type) + '.');
  }

  function validateCommentsConfig(value, schema) {
    return validateConfigValue(value, schema, 'comments config');
  }

  async function loadCommentsConfigSchema(options, fetchConfig) {
    if (options.schema != null) return options.schema;
    let response;
    try {
      response = await fetchConfig(options.schemaUrl || COMMENTS_CONFIG_SCHEMA_FILE, { cache: 'no-store' });
    } catch (error) {
      throw new Error('COMMENTS_CONFIG_SCHEMA_UNAVAILABLE: ' + (error && error.message || String(error)));
    }
    if (!response || !response.ok) {
      throw new Error('COMMENTS_CONFIG_SCHEMA_UNAVAILABLE: unable to load ' + COMMENTS_CONFIG_SCHEMA_FILE + '.');
    }
    try {
      return await response.json();
    } catch (error) {
      throw new Error('COMMENTS_CONFIG_SCHEMA_INVALID: ' + (error && error.message || String(error)));
    }
  }

  async function loadCommentsConfig(options) {
    const fetchConfig = options.fetchConfig || global.fetch;
    if (typeof fetchConfig !== 'function') throw new Error('COMMENTS_CONFIG_UNAVAILABLE: fetch is unavailable.');
    if (options.config != null) return validateCommentsConfig(options.config, await loadCommentsConfigSchema(options, fetchConfig));
    let response;
    try {
      response = await fetchConfig(options.configUrl || COMMENTS_CONFIG_FILE, { cache: 'no-store' });
    } catch (error) {
      throw new Error('COMMENTS_CONFIG_UNAVAILABLE: ' + (error && error.message || String(error)));
    }
    if (response && response.status === 404) return null;
    if (!response || !response.ok) throw new Error('COMMENTS_CONFIG_UNAVAILABLE: unable to load ' + COMMENTS_CONFIG_FILE + '.');
    let config;
    try {
      config = await response.json();
    } catch (error) {
      throw new Error('COMMENTS_CONFIG_INVALID_JSON: ' + (error && error.message || String(error)));
    }
    return validateCommentsConfig(config, await loadCommentsConfigSchema(options, fetchConfig));
  }

  function escapeCss(value) {
    if (global.CSS && typeof global.CSS.escape === 'function') return global.CSS.escape(String(value));
    return String(value).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  function fileNameOf(pathname) {
    const name = String(pathname == null ? '' : pathname).split('/').pop();
    return name || 'index.html';
  }

  function pageName() {
    return fileNameOf(location.pathname);
  }

  /* Page identity for a comparison between two resolved URLs. The file name
     alone is not identity — `docs/listing-c.html` and `/listing-c.html` share
     one — and the raw pathname is not either, because a prototype served at
     `/litro-desktop-redesign/` is the same page as `/litro-desktop-redesign/
     index.html`. Normalise the directory form to the index file pageName()
     already assumes it serves, then compare whole paths. */
  function pagePath(url) {
    const pathname = String(url.pathname || '/');
    return pathname.endsWith('/') ? pathname + fileNameOf(pathname) : pathname;
  }

  /* A thread's anchor.page is written by whoever wrote the thread and stored in
     Firestore, so every *read* of it is untrusted input, not just the write in
     anchorFor. Resolve first and then judge, because the check has to see what
     the browser will see: `javascript:`, `data:` and `blob:` survive URL
     construction with their payload intact, `//host` and `\\host` silently
     change origin, and a same-origin URL carrying credentials is a phishing
     surface. Only http(s) can be navigated to, and only on the prototype's own
     origin. */
  const NAVIGABLE_PROTOCOLS = ['http:', 'https:'];

  function httpUrl(reference, base) {
    let url;
    try {
      url = base == null ? new URL(reference) : new URL(reference, base);
    } catch (error) {
      return null;
    }
    if (NAVIGABLE_PROTOCOLS.indexOf(url.protocol) === -1) return null;
    if (url.username || url.password) return null;
    return url;
  }

  function navigableUrl(reference, base) {
    const root = httpUrl(base);
    if (!root) return null;
    const url = httpUrl(reference, root);
    return url && url.origin === root.origin ? url : null;
  }

  /* The page a stored anchor may claim to be on. A refused value reads as the
     page being viewed rather than as a different one: needsRestore would
     otherwise stay true forever and openThread would assign in a loop. The
     falsy guard mirrors deepLink's own `anchor.page || pageName()`, so a thread
     stored without a page resolves to the same page in both. */
  function safePageName(page, base) {
    const url = page ? navigableUrl(page, base) : null;
    return url ? fileNameOf(url.pathname) : pageName();
  }

  /* The same judgement at the granularity belongsToThisPage now renders by.
     The navigate-or-not decision has to agree with the render decision, or a
     thread anchored to `docs/listing-c.html` draws no pin on `/listing-c.html`
     (correct) and yet opening it from the overview refuses to navigate there
     (wrong) — the reviewer lands on the wrong file with the address bar
     rewritten to the right one. A refused or absent value still reads as the
     page being viewed, so openThread cannot assign in a loop. */
  function safePagePath(page, base) {
    const url = page ? navigableUrl(page, base) : null;
    return url ? pagePath(url) : pagePath(base);
  }

  function stateFromBody(config) {
    const ignored = new Set(['page', 'export', 'commenting']);
    const keys = Array.isArray(config.stateKeys) && config.stateKeys.length
      ? config.stateKeys
      : Object.keys(document.body.dataset).filter(key => !ignored.has(key));
    return keys.reduce((out, key) => {
      if (document.body.dataset[key] != null) out[key] = document.body.dataset[key];
      return out;
    }, {});
  }

  function nthPath(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 7) {
      const tag = node.tagName.toLowerCase();
      const siblings = Array.from(node.parentElement ? node.parentElement.children : []).filter(
        sibling => sibling.tagName === node.tagName,
      );
      parts.unshift(tag + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')');
      node = node.parentElement;
    }
    return parts.length ? 'body > ' + parts.join(' > ') : 'body';
  }

  function selectorFor(element) {
    /* Stable data-derived markers outrank a child's own id or positional path.
       The returned element is the element the selector really names; anchor
       coordinates must be measured against that same box. */
    let marked = element;
    while (marked && marked.nodeType === 1) {
      if (marked.hasAttribute && marked.hasAttribute('data-c')) {
        const value = marked.getAttribute('data-c');
        if (value && value.trim()) {
          return {
            element: marked,
            selector: '[data-c="' + escapeCss(value) + '"]',
            selectorKind: 'data',
          };
        }
      }
      marked = marked.parentElement;
    }
    if (element.id) return { element, selector: '#' + escapeCss(element.id), selectorKind: 'id' };
    return { element, selector: nthPath(element), selectorKind: 'path' };
  }

  function labelFor(element) {
    const labelled = element.getAttribute && (element.getAttribute('aria-label') || element.getAttribute('title'));
    if (labelled) return text(labelled);
    const button = element.closest && element.closest('button, a, [role="button"], label');
    if (button && text(button.textContent)) return text(button.textContent);
    let previous = element;
    while (previous && previous !== document.body) {
      const heading = previous.previousElementSibling && previous.previousElementSibling.matches('h1,h2,h3,h4,h5,h6')
        ? previous.previousElementSibling
        : previous.parentElement && previous.parentElement.querySelector('h1,h2,h3,h4,h5,h6');
      if (heading && text(heading.textContent)) return text(heading.textContent);
      previous = previous.parentElement;
    }
    return text(element.textContent).slice(0, 120) || element.tagName.toLowerCase();
  }

  function anchorFor(element, event, config) {
    if (!element || element.nodeType !== 1) anchorError('target must be an element.');
    const selector = selectorFor(element);
    const anchored = selector.element;
    const rect = anchored.getBoundingClientRect();
    const clientX = event && event.clientX != null ? event.clientX : rect.left + rect.width / 2;
    const clientY = event && event.clientY != null ? event.clientY : rect.top + rect.height / 2;
    const viewport = config.viewport || document.body.dataset.viewport || (/^m[-.]/.test(pageName()) ? 'mobile' : 'desktop');
    return validateCommentAnchor({
      page: pagePath(new URL(location.href)),
      viewport: viewport === 'mobile' ? 'mobile' : 'desktop',
      lang: document.documentElement.lang || config.lang || 'und',
      state: stateFromBody(config),
      selector: selector.selector,
      selectorKind: selector.selectorKind,
      rx: rect.width ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0.5,
      ry: rect.height ? Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) : 0.5,
      label: labelFor(anchored),
      text: text(anchored.innerText || anchored.textContent).slice(0, ANCHOR_LIMITS.text),
    });
  }

  function anchorCoordinate(value) {
    const coordinate = Number(value);
    return Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1 ? coordinate : 0.5;
  }

  function elementFor(anchor) {
    if (!anchor) return null;
    try {
      const direct = anchor.selector && document.querySelector(anchor.selector);
      if (direct) return direct;
    } catch (error) {
      // A stale selector is handled by the text fallback below.
    }
    const wanted = text(anchor.text);
    if (!wanted) return null;
    return $$('body *').find(element => {
      const candidate = text(element.innerText || element.textContent);
      return candidate === wanted || (wanted.length > 12 && candidate.indexOf(wanted) !== -1);
    }) || null;
  }

  function discussionAnchor(target, event, config) {
    if (target && target.nodeType === 1) return anchorFor(target, event || null, config);
    if (target && target.anchor) return validateCommentAnchor(target.anchor);
    if (plainObject(target)) return validateCommentAnchor(Object.assign({
      page: pagePath(new URL(location.href)),
      viewport: config.viewport || document.body.dataset.viewport || (/^m[-.]/.test(pageName()) ? 'mobile' : 'desktop'),
      lang: document.documentElement.lang || config.lang || 'und',
      state: stateFromBody(config),
      label: target.selector || 'Discussion',
      text: '',
      rx: 0.5,
      ry: 0.5,
    }, target));
    if (typeof target !== 'string' || !target.trim()) return null;
    const key = target.trim();
    const selector = key.indexOf('[data-c') === 0 ? key : '[data-c="' + escapeCss(key) + '"]';
    let element = null;
    try { element = $(selector); } catch (error) { return null; }
    if (element) return anchorFor(element, event || null, config);
    return null;
  }

  function discussionBody(message) {
    return text(plainObject(message) ? message.body : message);
  }

  function threadId(thread) {
    return plainObject(thread) ? thread.id : thread;
  }

  function messageData(message) {
    return {
      id: message.id,
      createdAt: iso(message.createdAt),
      author: message.author || {},
      body: message.body || '',
      agent: Boolean(message.agent),
    };
  }

  function compareByTimestampThenId(left, right) {
    return String(iso(left.createdAt) || '').localeCompare(String(iso(right.createdAt) || ''))
      || String(left.id || '').localeCompare(String(right.id || ''));
  }

  function isAuthoritativeDeletionSnapshot(snapshot) {
    return Boolean(
      snapshot
      && typeof snapshot.exists === 'function'
      && snapshot.exists() === false
      /* A cache-only absence is not proof that a server accepted the delete:
         an offline client can temporarily know neither a document nor the
         rejection that restores it. Firestore snapshots always carry metadata;
         the metadata-less branch keeps the helper usable with small test
         doubles while production requires both server data and no pending
         local mutation. */
      && (!snapshot.metadata || (
        snapshot.metadata.hasPendingWrites !== true
        && snapshot.metadata.fromCache !== true
      ))
    );
  }

  function threadSummary(snapshot) {
    const data = snapshot.data();
    return Object.assign({ id: snapshot.id }, data, {
      createdAt: iso(data.createdAt),
      resolvedAt: data.resolvedAt ? iso(data.resolvedAt) : null,
    });
  }

  function cursorFor(snapshot) {
    const data = snapshot.data();
    if (!data || data.createdAt == null) throw new Error('COMMENTS_THREAD_MISSING_CREATED_AT');
    return { createdAt: data.createdAt, id: snapshot.id };
  }

  function concurrencyLimiter(limit) {
    let active = 0;
    const waiting = [];
    function schedule() {
      if (active >= limit || !waiting.length) return;
      active += 1;
      const next = waiting.shift();
      Promise.resolve().then(next.task).then(next.resolve, next.reject).finally(() => {
        active -= 1;
        schedule();
      });
    }
    return task => new Promise((resolve, reject) => {
      waiting.push({ task, resolve, reject });
      schedule();
    });
  }

  async function createFirebaseClient(config, dependencies) {
    const options = dependencies || {};
    const loadModule = options.loadModule || (url => import(url));
    const appApi = await loadModule(FIREBASE_CDN + 'firebase-app.js');
    const authApi = await loadModule(FIREBASE_CDN + 'firebase-auth.js');
    const dbApi = await loadModule(FIREBASE_CDN + 'firebase-firestore.js');
    const firebaseConfig = config.firebase;

    const app = appApi.getApps().find(candidate => candidate.options.projectId === firebaseConfig.projectId)
      || appApi.initializeApp(firebaseConfig);
    const auth = authApi.getAuth(app);
    const db = dbApi.getFirestore(app);
    const threads = dbApi.collection(db, 'prototypes', config.prototypeId, 'threads');
    const authoritativeObservers = new Set();
    const threadWatchers = new Map();

    function stopThreadWatcher(threadId) {
      const unsubscribe = threadWatchers.get(threadId);
      if (unsubscribe) unsubscribe();
      threadWatchers.delete(threadId);
    }

    function resetThreadWatchers() {
      Array.from(threadWatchers.keys()).forEach(stopThreadWatcher);
    }

    function watchThreadDocument(snapshot) {
      if (!snapshot || !snapshot.id || !snapshot.ref || threadWatchers.has(snapshot.id)) return;
      const unsubscribe = dbApi.onSnapshot(
        snapshot.ref,
        { includeMetadataChanges: true },
        current => {
          if (!isAuthoritativeDeletionSnapshot(current)) return;
          stopThreadWatcher(snapshot.id);
          authoritativeObservers.forEach(observer => observer(snapshot.id));
        },
        error => {
          authoritativeObservers.forEach(observer => observer(null, error));
        },
      );
      threadWatchers.set(snapshot.id, unsubscribe);
    }

    function pageQuery(cursor) {
      const constraints = [
        dbApi.orderBy('createdAt'),
        dbApi.orderBy(dbApi.documentId()),
        dbApi.limit(THREAD_PAGE_SIZE),
      ];
      if (cursor) constraints.push(dbApi.startAfter(cursor.createdAt, cursor.id));
      return dbApi.query(threads, ...constraints);
    }

    async function readThread(snapshot) {
      const messages = await dbApi.getDocs(
        dbApi.query(
          dbApi.collection(snapshot.ref, 'messages'),
          dbApi.orderBy('createdAt'),
          dbApi.orderBy(dbApi.documentId())
        )
      );
      return Object.assign({ id: snapshot.id }, snapshot.data(), {
        createdAt: iso(snapshot.data().createdAt),
        resolvedAt: snapshot.data().resolvedAt ? iso(snapshot.data().resolvedAt) : null,
        messages: messages.docs.map(item => messageData(Object.assign({ id: item.id }, item.data())))
          .sort(compareByTimestampThenId),
      });
    }

    async function loadSummaryPage(cursor) {
      const snapshot = await dbApi.getDocs(pageQuery(cursor));
      const docs = snapshot.docs || [];
      docs.forEach(watchThreadDocument);
      return {
        threads: docs.map(threadSummary).sort(compareByTimestampThenId),
        nextCursor: docs.length === THREAD_PAGE_SIZE ? cursorFor(docs[docs.length - 1]) : null,
      };
    }

    const limitDetails = concurrencyLimiter(DETAIL_CONCURRENCY);
    let nextCursor = null;
    let loadedBeyondFirstPage = false;

    const commentsStore = {
      list: async function list() {
        const page = await loadSummaryPage(null);
        nextCursor = page.nextCursor;
        loadedBeyondFirstPage = false;
        return page.threads;
      },
      subscribe: function subscribe(onChange, onError) {
        return dbApi.onSnapshot(pageQuery(null), async snapshot => {
          try {
            const docs = snapshot.docs || [];
            docs.forEach(watchThreadDocument);
            const firstPageCursor = docs.length === THREAD_PAGE_SIZE ? cursorFor(docs[docs.length - 1]) : null;
            if (!loadedBeyondFirstPage) nextCursor = firstPageCursor;
            onChange(docs.map(threadSummary).sort(compareByTimestampThenId));
          } catch (error) {
            if (onError) onError(error);
          }
        }, onError);
      },
      add: async function add(thread, message) {
        const anchor = validateCommentAnchor(thread && thread.anchor);
        const threadRef = dbApi.doc(threads);
        const messageRef = dbApi.doc(dbApi.collection(threadRef, 'messages'));
        const now = new Date().toISOString();
        const batch = dbApi.writeBatch(db);
        batch.set(threadRef, {
          createdAt: now,
          createdBy: thread.createdBy,
          status: 'open',
          resolvedAt: null,
          resolvedBy: null,
          orphaned: false,
          anchor,
          updatedAt: now,
        });
        batch.set(messageRef, {
          createdAt: now,
          author: message.author,
          body: message.body,
          agent: false,
        });
        await batch.commit();
        return threadRef.id;
      },
      reply: async function reply(threadId, message) {
        const threadRef = dbApi.doc(threads, threadId);
        const messageRef = dbApi.doc(dbApi.collection(threadRef, 'messages'));
        const now = new Date().toISOString();
        const batch = dbApi.writeBatch(db);
        batch.set(messageRef, {
          createdAt: now,
          author: message.author,
          body: message.body,
          agent: Boolean(message.agent),
        });
        batch.update(threadRef, { updatedAt: now });
        await batch.commit();
      },
      resolve: async function resolve(threadId, reviewer) {
        await dbApi.updateDoc(dbApi.doc(threads, threadId), {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
          resolvedBy: reviewer,
          updatedAt: new Date().toISOString(),
        });
      },
    };

    // Role lookup, complete deletion and authoritative document watches stay
    // private. Callers receive one layer-owned capability and cannot forge a
    // role by passing it into a public store method.
    const capabilities = {
      hasNextPage: () => nextCursor !== null,
      loadNextPage: async () => {
        if (!nextCursor) return [];
        const page = await loadSummaryPage(nextCursor);
        nextCursor = page.nextCursor;
        loadedBeyondFirstPage = true;
        return page.threads;
      },
      loadThreadDetail: threadId => limitDetails(async () => {
        const snapshot = await dbApi.getDoc(dbApi.doc(threads, threadId));
        return snapshot.exists() ? readThread(snapshot) : null;
      }),
      readOwnerRole: async user => {
        if (!user || user.emailVerified !== true || typeof user.email !== 'string' || !user.email) return false;
        const snapshot = await dbApi.getDoc(dbApi.doc(db, 'allowed', user.email));
        return snapshot.exists() && snapshot.data().user === 'owner';
      },
      deleteThread: async threadId => {
        const threadRef = dbApi.doc(threads, threadId);
        let snapshot = await dbApi.getDoc(threadRef);
        if (!snapshot.exists()) {
          stopThreadWatcher(threadId);
          return { state: 'already-deleted' };
        }
        if (snapshot.data().status !== 'deleting') {
          if (['open', 'resolved'].indexOf(snapshot.data().status) === -1) {
            throw new Error('COMMENTS_THREAD_DELETE_STATE_INVALID');
          }
          await dbApi.updateDoc(threadRef, { status: 'deleting', updatedAt: new Date().toISOString() });
        }
        const messages = dbApi.collection(threadRef, 'messages');
        while (true) {
          const page = await dbApi.getDocs(
            dbApi.query(messages, dbApi.orderBy(dbApi.documentId()), dbApi.limit(DELETE_BATCH_SIZE))
          );
          const docs = page.docs || [];
          if (!docs.length) break;
          const batch = dbApi.writeBatch(db);
          docs.forEach(message => batch.delete(message.ref));
          await batch.commit();
        }
        snapshot = await dbApi.getDoc(threadRef);
        if (!snapshot.exists()) return { state: 'already-deleted' };
        await dbApi.deleteDoc(threadRef);
        return { state: 'awaiting-authoritative-snapshot' };
      },
      subscribeAuthoritative: observer => {
        authoritativeObservers.add(observer);
        return () => authoritativeObservers.delete(observer);
      },
      resetThreadWatchers,
      setOrphaned: (threadId, orphaned) => dbApi.updateDoc(dbApi.doc(threads, threadId), {
        orphaned: Boolean(orphaned),
        updatedAt: new Date().toISOString(),
      }),
    };
    STORE_PRIVATE.set(commentsStore, capabilities);

    return {
      store: commentsStore,
      capabilities,
      observeUser: callback => authApi.onAuthStateChanged(auth, callback),
      signIn: async function signIn() {
        const provider = new authApi.GoogleAuthProvider();
        try {
          return await authApi.signInWithPopup(auth, provider);
        } catch (error) {
          const redirectCodes = new Set(['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request']);
          if (redirectCodes.has(error && error.code) || /popup/i.test(String(error && error.message))) {
            await authApi.signInWithRedirect(auth, provider);
            return null;
          }
          throw error;
        }
      },
    };
  }

  function privateOrphanUpdate(store, threadId, orphaned) {
    const details = STORE_PRIVATE.get(store);
    return details ? details.setOrphaned(threadId, orphaned) : Promise.resolve();
  }

  function privateHasNextPage(store, injected) {
    const details = injected || STORE_PRIVATE.get(store);
    return Boolean(details && typeof details.hasNextPage === 'function' && details.hasNextPage());
  }

  function privateLoadNextPage(store, injected) {
    const details = injected || STORE_PRIVATE.get(store);
    return details && typeof details.loadNextPage === 'function' ? details.loadNextPage() : Promise.resolve([]);
  }

  function privateLoadThreadDetail(store, threadId, injected) {
    const details = injected || STORE_PRIVATE.get(store);
    return details && typeof details.loadThreadDetail === 'function'
      ? details.loadThreadDetail(threadId)
      : Promise.resolve(null);
  }

  function privateCapabilities(store, injected) {
    return injected || STORE_PRIVATE.get(store) || null;
  }

  function privateReadOwnerRole(store, user, injected) {
    const details = privateCapabilities(store, injected);
    return details && typeof details.readOwnerRole === 'function'
      ? details.readOwnerRole(user)
      : Promise.resolve(false);
  }

  function privateDeleteThread(store, threadId, injected) {
    const details = privateCapabilities(store, injected);
    return details && typeof details.deleteThread === 'function'
      ? details.deleteThread(threadId)
      : Promise.reject(new Error('COMMENTS_DELETE_UNAVAILABLE'));
  }

  function privateSubscribeAuthoritative(store, observer, injected) {
    const details = privateCapabilities(store, injected);
    return details && typeof details.subscribeAuthoritative === 'function'
      ? details.subscribeAuthoritative(observer)
      : () => {};
  }

  function privateResetThreadWatchers(store, injected) {
    const details = privateCapabilities(store, injected);
    if (details && typeof details.resetThreadWatchers === 'function') details.resetThreadWatchers();
  }

  class CommentLayer {
    constructor(config, options) {
      this.config = config;
      this.options = options;
      this.store = options.store || null;
      /* An overview page reads the same store through the same layer, but owns
         no anchors to pin against. Told so, the layer stops before every
         thread's anchor fails to resolve and gets written back as orphaned — a
         page that presents itself as read-only must not write. Hiding the pins
         in CSS does not stop the write; only not rendering them does. */
      this.overview = Boolean(options.overview);
      this.client = null;
      this.capabilities = options.capabilities || null;
      this.user = options.user || null;
      this.threads = [];
      /* "A delivery has happened" is not "there are threads". An overview page
         replaces setThreads after init() resolves and has to catch up on a
         delivery that beat it there; asking `threads.length` instead reads an
         empty store and a store that has not answered yet as the same state,
         so an empty prototype sat on "Loading…" for ever. */
      this.threadsDelivered = false;
      this.hasNextPage = false;
      this.showResolved = false;
      this.activeThread = null;
      this.unsubscribe = null;
      this.authUnsubscribe = null;
      this.authoritativeUnsubscribe = null;
      this.deepLinkHandled = false;
      this.toolbar = null;
      this.tray = null;
      this.popover = null;
      this.selectionPrompt = null;
      this.selectionClick = null;
      this.selectionKeydown = null;
      this.authGeneration = 0;
      this.owner = false;
      this.ownerResolved = false;
      this.capabilityListeners = new Set();
      this.deletionOperations = new Map();
      this.deletionErrors = new Map();
      this.positionPins = this.positionPins.bind(this);
      this.destroy = this.destroy.bind(this);
    }

    async start() {
      this.buildShell();
      if (!this.store) {
        this.client = await (this.options.createFirebaseClient || createFirebaseClient)(this.config);
        this.store = this.client.store;
        this.capabilities = this.client.capabilities || this.capabilities;
        this.authUnsubscribe = this.client.observeUser(user => this.setUser(user));
      } else {
        this.setUser(this.user);
      }
      this.authoritativeUnsubscribe = privateSubscribeAuthoritative(
        this.store,
        (threadId, error) => {
          if (error) {
            this.showError('Live comment deletion could not be observed. Reload and try again.', error);
            return;
          }
          if (threadId) this.removeThread(threadId);
        },
        this.capabilities,
      );
      global.addEventListener('resize', this.positionPins);
      global.addEventListener('scroll', this.positionPins, true);
      global.addEventListener('pagehide', this.destroy);
    }

    /* The layer's on-screen chrome — pin toolbar, detached tray, popover — is
       addressed to a screen with anchors to pin against. An overview page has
       none, so it builds none: not created rather than created and hidden,
       because a `display:none` rule is a second mechanism that has to agree
       with the first one for ever. The overview carries its own sign-in
       control and its own error paragraph, and the layer's showError already
       degrades to "console only" when there is no popover to open. */
    buildShell() {
      if (this.overview) return;
      this.toolbar = document.createElement('aside');
      this.toolbar.className = 'proto-comments-tools';
      this.toolbar.setAttribute('aria-label', 'Prototype comments');
      this.toolbar.innerHTML = '<button type="button" class="pc-signin">Sign in to comment</button>'
        + '<button type="button" class="pc-add" disabled>Add comment</button>'
        + '<button type="button" class="pc-more" hidden>Load older comments</button>'
        + '<label class="pc-filter"><input type="checkbox"> Show resolved</label>';
      /* "What else is open?" is a question asked from inside a pin, not only
         from the hub — proto-sheets.js gives the demo panel the matching
         .pt-sheet-page link (IMPL-25); this is the toolbar's half, the
         cheaper of the two routes since it is the surface already on screen.
         Built from pageBase(), the ONLY correct base for anything clicked
         in-page — shareBase() resolves against config.prototypeUrl and would
         walk a reviewer off their own copy onto the published site (see
         CLAUDE.md, "Two link kinds, and they must not share a base").
         Assigned via the .href property rather than folded into the
         innerHTML string above, so nothing built from location.href can
         break out of the markup. Reviewer chrome is always English, independent
         of the product screen's language. */
      const overview = document.createElement('a');
      overview.className = 'pc-overview';
      overview.href = new URL(OVERVIEW_PAGE, this.pageBase()).href;
      overview.textContent = 'Open comments';
      this.toolbar.appendChild(overview);
      this.tray = document.createElement('aside');
      this.tray.className = 'proto-comments-tray';
      this.tray.hidden = true;
      this.popover = document.createElement('section');
      this.popover.className = 'proto-comments-popover';
      this.popover.hidden = true;
      this.selectionPrompt = document.createElement('aside');
      this.selectionPrompt.className = 'proto-comments-selection';
      this.selectionPrompt.hidden = true;
      this.selectionPrompt.setAttribute('role', 'status');
      this.selectionPrompt.setAttribute('aria-live', 'assertive');
      this.selectionPrompt.innerHTML = '<strong>Click the place on the page where you want to add the comment</strong>'
        + '<button type="button" class="pc-cancel-selection">Cancel</button>';
      document.body.append(this.toolbar, this.tray, this.popover, this.selectionPrompt);
      $('.pc-signin', this.toolbar).onclick = () => this.signIn();
      $('.pc-add', this.toolbar).onclick = () => this.beginSelection();
      $('.pc-more', this.toolbar).onclick = () => this.loadOlderThreads();
      $('.pc-cancel-selection', this.selectionPrompt).onclick = () => this.cleanupSelection();
      $('input', this.toolbar).onchange = event => {
        this.showResolved = event.target.checked;
        this.renderThreads();
      };
    }

    async signIn() {
      try {
        if (this.options.signIn) await this.options.signIn();
        else if (this.client) await this.client.signIn();
      } catch (error) {
        this.showError('Google sign-in could not start. Check the authorised domain and try again.', error);
      }
    }

    setUser(user) {
      const generation = ++this.authGeneration;
      this.cleanupSelection();
      if (this.unsubscribe) this.unsubscribe();
      this.unsubscribe = null;
      privateResetThreadWatchers(this.store, this.capabilities);
      this.user = user || null;
      this.owner = false;
      this.ownerResolved = false;
      this.activeThread = null;
      if (this.popover) this.popover.hidden = true;
      this.notifyCapabilities();
      const signedIn = Boolean(this.user);
      // No toolbar on an overview page; the store and the auth observer behind
      // it work exactly as they do on a screen.
      if (this.toolbar) {
        $('.pc-signin', this.toolbar).hidden = signedIn;
        $('.pc-add', this.toolbar).disabled = !signedIn;
      }
      if (!signedIn) {
        this.setThreads([]);
        return;
      }
      if (this.store) this.loadThreads(generation);
      if (this.user.emailVerified !== true || typeof this.user.email !== 'string' || !this.user.email) {
        this.ownerResolved = true;
        this.notifyCapabilities();
        return;
      }
      const candidate = this.user;
      const lookup = account => privateReadOwnerRole(this.store, account, this.capabilities);
      Promise.resolve().then(() => lookup(candidate)).then(isOwner => {
        if (generation !== this.authGeneration) return;
        this.owner = isOwner === true;
        this.ownerResolved = true;
        this.notifyCapabilities();
        this.renderThreads();
      }, () => {
        if (generation !== this.authGeneration) return;
        this.owner = false;
        this.ownerResolved = true;
        this.notifyCapabilities();
        this.renderThreads();
      });
    }

    async loadThreads(generation) {
      if (generation == null) generation = this.authGeneration;
      try {
        /* Two statements, not one. `this.setThreads(await …)` resolves the
           method **before** awaiting, so a page that replaces `setThreads`
           after `init()` resolves — which is what the overview page does to
           learn about deliveries — is bypassed for the first one. Production
           only ever won that race by the backend's own scheduling. */
        const initial = await this.store.list();
        if (generation !== this.authGeneration) return;
        this.setThreads(initial);
        this.hasNextPage = privateHasNextPage(this.store, this.capabilities);
        this.updateLoadMoreControl();
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = this.store.subscribe(threads => {
          if (generation !== this.authGeneration) return;
          this.setThreads(threads, true);
          this.hasNextPage = privateHasNextPage(this.store, this.capabilities);
          this.updateLoadMoreControl();
        }, error => {
          if (generation === this.authGeneration) {
            this.showError(error && error.message || 'Subscription error', error);
          }
        });
      } catch (error) {
        if (generation !== this.authGeneration) return;
        this.showError('Comments are unavailable. Confirm that this account is allowed to review this prototype.', error);
      }
    }

    destroy() {
      ++this.authGeneration;
      this.cleanupSelection();
      if (this.unsubscribe) this.unsubscribe();
      if (this.authUnsubscribe) this.authUnsubscribe();
      if (this.authoritativeUnsubscribe) this.authoritativeUnsubscribe();
      this.unsubscribe = null;
      this.authUnsubscribe = null;
      this.authoritativeUnsubscribe = null;
      privateResetThreadWatchers(this.store, this.capabilities);
      global.removeEventListener('resize', this.positionPins);
      global.removeEventListener('scroll', this.positionPins, true);
      global.removeEventListener('pagehide', this.destroy);
    }

    onCapabilitiesChanged(listener) {
      this.capabilityListeners.add(listener);
      listener();
      return () => this.capabilityListeners.delete(listener);
    }

    notifyCapabilities() {
      this.capabilityListeners.forEach(listener => listener());
    }

    updateLoadMoreControl() {
      const more = this.toolbar && $('.pc-more', this.toolbar);
      if (more) more.hidden = !this.hasNextPage;
    }

    setThreads(threads, merge) {
      const incoming = (threads || []).slice();
      if (merge) {
        const byId = new Map(this.threads.map(thread => [thread.id, thread]));
        incoming.forEach(thread => {
          const current = byId.get(thread.id);
          if (current && Array.isArray(current.messages) && current.updatedAt === thread.updatedAt) {
            byId.set(thread.id, Object.assign({}, thread, { messages: current.messages }));
          } else {
            byId.set(thread.id, thread);
          }
        });
        this.threads = [...byId.values()];
      } else {
        this.threads = incoming;
      }
      this.threads.sort(compareByTimestampThenId);
      this.threadsDelivered = true;
      this.renderThreads();
      if (!this.deepLinkHandled) this.openHashThread();
    }

    removeThread(threadId) {
      const before = this.threads.length;
      this.threads = this.threads.filter(thread => thread.id !== threadId);
      this.deletionErrors.delete(threadId);
      if (this.activeThread && this.activeThread.id === threadId) {
        this.activeThread = null;
        if (this.popover) this.popover.hidden = true;
      }
      if (this.threads.length !== before) {
        this.renderThreads();
        this.notifyCapabilities();
      }
    }

    canDelete(thread) {
      return Boolean(
        this.ownerResolved && this.owner && thread && thread.id
        && ['open', 'resolved', 'deleting'].indexOf(thread.status) !== -1
      );
    }

    deleteThread(thread) {
      const current = thread && this.threads.find(item => item.id === thread.id) || thread;
      if (!this.canDelete(current)) return Promise.reject(new Error('COMMENTS_DELETE_FORBIDDEN'));
      if (this.deletionOperations.has(current.id)) return this.deletionOperations.get(current.id);
      const confirmDelete = this.options.confirmDelete || (message => {
        return typeof global.confirm === 'function' ? global.confirm(message) : false;
      });
      const label = current.anchor && current.anchor.label || current.id;
      if (current.status !== 'deleting'
        && !confirmDelete('Delete the entire comment thread “' + label + '”? This cannot be undone.')) {
        return Promise.resolve(false);
      }
      this.deletionErrors.delete(current.id);
      const deleting = Object.assign({}, current, { status: 'deleting' });
      this.setThreads([deleting], true);
      const operation = privateDeleteThread(this.store, current.id, this.capabilities).then(result => {
        /* A missing document observed by the deletion read is already an
           authoritative final state. Otherwise the document watcher owns UI
           removal; a completed delete request alone is not proof that the
           subscribed client has observed disappearance. */
        if (result && result.state === 'already-deleted') this.removeThread(current.id);
        return true;
      }).catch(error => {
        this.deletionErrors.set(current.id, 'Deletion did not finish. Retry deletion.');
        this.setThreads([deleting], true);
        throw error;
      }).finally(() => {
        this.deletionOperations.delete(current.id);
        this.notifyCapabilities();
      });
      this.deletionOperations.set(current.id, operation);
      this.notifyCapabilities();
      if (this.activeThread && this.activeThread.id === current.id) this.showComposer(deleting);
      return operation;
    }

    /* Document discussions are another presentation over this layer, not a
       second backend. This small facade keeps their reads and writes on the
       same authenticated store while hiding Firebase-specific details. */
    threadsAt(target) {
      const anchor = discussionAnchor(target, null, this.config);
      if (!anchor || !anchor.selector) return [];
      return this.threads.filter(thread => this.belongsToThisPage(thread)
        && thread.anchor && thread.anchor.selector === anchor.selector);
    }

    async loadDetail(thread) {
      const id = threadId(thread);
      if (!id) return null;
      const current = plainObject(thread) ? thread : this.threads.find(item => item.id === id);
      const detail = await privateLoadThreadDetail(this.store, id, this.capabilities);
      if (detail) this.setThreads([detail], true);
      return detail || current || null;
    }

    async startThread(target, message, event) {
      if (!this.user) throw new Error('COMMENT_REVIEWER_SIGN_IN_REQUIRED');
      const anchor = discussionAnchor(target, event || null, this.config);
      const body = discussionBody(message);
      if (!anchor || !anchor.selector) throw new Error('COMMENT_ANCHOR_REQUIRED');
      if (!body) throw new Error('COMMENT_BODY_REQUIRED');
      return this.store.add(
        { createdBy: actor(this.user), anchor: validateCommentAnchor(anchor) },
        { author: actor(this.user), body: body, agent: false },
      );
    }

    async replyTo(thread, message) {
      if (!this.user) throw new Error('COMMENT_REVIEWER_SIGN_IN_REQUIRED');
      if (thread && thread.status === 'deleting') throw new Error('COMMENTS_THREAD_DELETING');
      const id = threadId(thread);
      const body = discussionBody(message);
      if (!id) throw new Error('COMMENT_THREAD_REQUIRED');
      if (!body) throw new Error('COMMENT_BODY_REQUIRED');
      return this.store.reply(id, { author: actor(this.user), body: body, agent: false });
    }

    async resolveThread(thread) {
      if (!this.user) throw new Error('COMMENT_REVIEWER_SIGN_IN_REQUIRED');
      if (thread && thread.status === 'deleting') throw new Error('COMMENTS_THREAD_DELETING');
      const id = threadId(thread);
      if (!id) throw new Error('COMMENT_THREAD_REQUIRED');
      return this.store.resolve(id, actor(this.user));
    }

    async loadOlderThreads() {
      try {
        const older = await privateLoadNextPage(this.store, this.capabilities);
        this.setThreads(older, true);
        this.hasNextPage = privateHasNextPage(this.store, this.capabilities);
        this.updateLoadMoreControl();
      } catch (error) {
        this.showError('Older comments could not be loaded. Try again.', error);
      }
    }

    /* A pin belongs to the page its comment was written on. RO and EN screens
       are sibling files with identical structure, so a selector written on one
       resolves on the other and the anchor alone cannot tell them apart: a
       thread anchored to listing-c-en.html drew its pin on listing-c.html too.
       Page identity is the *file*, not the flow step — the mobile set is a
       different file anyway, and viewport and lang are restored by the deep
       link rather than used to decide ownership.

       What happens to a thread belonging to another page is a decision, and it
       is this: nothing. It is not a pin here, and it is emphatically not
       "detached" — detached states that the anchor broke, a fact this page
       cannot establish about another page's markup, and claiming it would write
       a false orphan marker to the store on every load. Such a thread stays
       whole, reachable through its #c=<id> deep link (which restores its page)
       and through the comments overview, which is the surface that shows all
       pages at once.

       anchor.page is store input, so it is untrusted: it is judged only after
       resolving, exactly as deepLink and needsRestore judge it — and compared
       as a whole path. A file name alone makes `docs/listing-c.html` and
       `/listing-c.html` one page, which is a second way for one thread to pin
       itself onto two screens, and it is the comparison a prototype published
       under a directory prefix needs: `pageBase()` carries that prefix too. */
    belongsToThisPage(thread) {
      const anchor = (thread && thread.anchor) || {};
      // Absent page: a thread stored before the field existed. deepLink already
      // reads that as "the page being viewed", so it renders here.
      if (!anchor.page) return true;
      const base = this.pageBase();
      const url = navigableUrl(anchor.page, base);
      // A value that will not resolve to a navigable same-origin URL names no
      // page of this prototype, so it is nobody's pin.
      return Boolean(url) && pagePath(url) === pagePath(base);
    }

    renderThreads() {
      $$('.proto-comment-pin').forEach(pin => pin.remove());
      // An overview page has no anchors, so every thread would miss, take the
      // detached branch below and be written back as orphaned. It reads
      // `this.threads` directly instead of being drawn on.
      if (this.overview) return;
      const detached = [];
      this.threads.filter(thread => this.belongsToThisPage(thread)).forEach(thread => {
        const target = elementFor(thread.anchor);
        /* A thread with no stored page renders here — deepLink and
           safePageName read a missing page as "the page being viewed", and
           making this one disagree would strand every thread written before
           the field existed. What this page cannot do is claim to know whether
           such a thread's anchor broke: it resolves on the screen it was
           written on and misses everywhere else, so the orphan flag flapped
           true/false with one store write per screen the reviewer walked
           through. That is the same argument the block above makes about
           another page's markup. The accepted cost is that a page-less thread
           whose selector resolves on two screens renders on both and neither
           writes. */
        const locatable = Boolean(thread.anchor && thread.anchor.page);
        if (!target) {
          detached.push(thread);
          if (!thread.orphaned && locatable) privateOrphanUpdate(this.store, thread.id, true).catch(() => {});
          return;
        }
        if (thread.orphaned && locatable) privateOrphanUpdate(this.store, thread.id, false).catch(() => {});
        if (thread.status === 'resolved' && !this.showResolved) return;
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'proto-comment-pin'
          + (thread.status === 'resolved' ? ' resolved' : '')
          + (thread.status === 'deleting' ? ' deleting' : '');
        pin.dataset.threadId = thread.id;
        pin.setAttribute('aria-label', 'Open comment: ' + (thread.anchor && thread.anchor.label || 'comment'));
        pin.textContent = thread.status === 'resolved' ? '✓' : (thread.status === 'deleting' ? '…' : '●');
        pin.onclick = () => this.openThread(thread).catch(error => this.showError('This comment could not be opened.', error));
        document.body.appendChild(pin);
        this.positionPin(pin, target, thread.anchor);
      });
      this.renderDetached(detached);
      this.positionPins();
    }

    positionPin(pin, target, anchor) {
      const rect = target.getBoundingClientRect();
      pin.style.left = (rect.left + rect.width * anchorCoordinate(anchor.rx)) + 'px';
      pin.style.top = (rect.top + rect.height * anchorCoordinate(anchor.ry)) + 'px';
    }

    positionPins() {
      $$('.proto-comment-pin').forEach(pin => {
        const thread = this.threads.find(item => item.id === pin.dataset.threadId);
        const target = thread && elementFor(thread.anchor);
        if (thread && target) this.positionPin(pin, target, thread.anchor);
      });
      if (this.activeThread && this.popover && !this.popover.hidden) this.positionPopover(this.activeThread);
    }

    renderDetached(threads) {
      if (!this.tray) return;
      this.tray.hidden = threads.length === 0;
      this.tray.replaceChildren();
      if (!threads.length) return;
      const title = document.createElement('strong');
      title.textContent = 'Detached comments';
      const detail = document.createElement('p');
      detail.textContent = 'These pins survived a changed screen and need a new anchor.';
      const list = document.createElement('ul');
      threads.forEach(thread => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = (thread.anchor && thread.anchor.label) || thread.id;
        button.onclick = () => this.openThread(thread).catch(error => this.showError('This comment could not be opened.', error));
        item.appendChild(button);
        list.appendChild(item);
      });
      this.tray.append(title, detail, list);
    }

    beginSelection() {
      if (!this.user) return;
      this.cleanupSelection();
      if (this.popover) this.popover.hidden = true;
      this.activeThread = null;
      document.body.dataset.commenting = '1';
      if (this.selectionPrompt) this.selectionPrompt.hidden = false;
      this.selectionClick = event => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest(COMMENT_SELECTION_CHROME)) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          const anchor = validateCommentAnchor(anchorFor(target, event, this.config));
          this.cleanupSelection();
          this.showComposer(null, anchor);
        } catch (error) {
          this.cleanupSelection();
          this.showError('This place cannot be used for a comment. Choose another target.', error);
        }
      };
      this.selectionKeydown = event => {
        if (event.key === 'Escape') this.cleanupSelection();
      };
      document.addEventListener('click', this.selectionClick, true);
      document.addEventListener('keydown', this.selectionKeydown, true);
    }

    cleanupSelection() {
      if (document.body && typeof document.body.removeAttribute === 'function') {
        document.body.removeAttribute('data-commenting');
      }
      if (this.selectionPrompt) this.selectionPrompt.hidden = true;
      if (this.selectionClick && typeof document.removeEventListener === 'function') {
        document.removeEventListener('click', this.selectionClick, true);
      }
      if (this.selectionKeydown && typeof document.removeEventListener === 'function') {
        document.removeEventListener('keydown', this.selectionKeydown, true);
      }
      this.selectionClick = null;
      this.selectionKeydown = null;
    }

    showComposer(thread, anchor) {
      // An overview builds no popover: openThread still fetches the detail and
      // still delivers it through setThreads, which is the whole of what that
      // page wants from this method.
      if (!this.popover) return;
      if (!thread) anchor = validateCommentAnchor(anchor);
      this.activeThread = thread || null;
      this.popover.hidden = false;
      this.popover.replaceChildren();
      const heading = document.createElement('strong');
      heading.textContent = thread ? (thread.anchor && thread.anchor.label || 'Comment') : 'New comment';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'pc-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close comment');
      close.onclick = () => {
        this.cleanupSelection();
        this.popover.hidden = true;
        this.activeThread = null;
      };
      const header = document.createElement('header');
      header.append(heading, close);
      this.popover.appendChild(header);

      if (thread) this.renderMessages(thread);
      if (thread && thread.status === 'deleting') {
        const deleting = document.createElement('p');
        deleting.className = 'pc-deleting';
        deleting.textContent = this.deletionErrors.get(thread.id)
          || 'This thread is being deleted and cannot accept replies.';
        this.popover.appendChild(deleting);
        if (this.canDelete(thread)) this.popover.appendChild(this.deleteButton(thread, 'Retry deletion'));
        this.positionPopover(thread);
        return;
      }
      const box = document.createElement('textarea');
      box.placeholder = thread ? 'Reply to this comment' : 'Describe what should change';
      box.rows = 3;
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.textContent = thread ? 'Reply' : 'Post comment';
      submit.onclick = async () => {
        const body = text(box.value);
        if (!body) return;
        submit.disabled = true;
        try {
          if (thread) await this.store.reply(thread.id, { author: actor(this.user), body: body, agent: false });
          else await this.store.add(
            { createdBy: actor(this.user), anchor: validateCommentAnchor(anchor) },
            { author: actor(this.user), body: body, agent: false }
          );
          box.value = '';
          if (!thread) this.popover.hidden = true;
        } catch (error) {
          this.showError('The comment was not saved. Check reviewer access and try again.', error);
        } finally {
          submit.disabled = false;
        }
      };
      const actions = document.createElement('footer');
      actions.appendChild(submit);
      if (thread && thread.status !== 'resolved') {
        const resolve = document.createElement('button');
        resolve.type = 'button';
        resolve.className = 'pc-resolve';
        resolve.textContent = 'Resolve';
        resolve.onclick = async () => {
          resolve.disabled = true;
          try { await this.store.resolve(thread.id, actor(this.user)); }
          catch (error) { this.showError('This comment could not be resolved.', error); }
          finally { resolve.disabled = false; }
        };
        actions.appendChild(resolve);
      }
      if (thread && this.canDelete(thread)) actions.appendChild(this.deleteButton(thread, 'Delete thread'));
      this.popover.append(box, actions);
      if (thread) this.positionPopover(thread);
      else {
        this.popover.style.left = '50%';
        this.popover.style.top = '50%';
        this.popover.style.transform = 'translate(-50%, -50%)';
      }
      box.focus();
    }

    deleteButton(thread, label) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pc-delete';
      button.textContent = label;
      button.disabled = this.deletionOperations.has(thread.id);
      button.onclick = async () => {
        button.disabled = true;
        try {
          await this.deleteThread(thread);
        } catch (error) {
          this.showComposer(this.threads.find(item => item.id === thread.id) || thread);
          note('thread deletion failed: ' + ((error && error.message) || String(error)));
        } finally {
          if (this.threads.some(item => item.id === thread.id)) button.disabled = false;
        }
      };
      return button;
    }

    renderMessages(thread) {
      const messages = document.createElement('div');
      messages.className = 'pc-messages';
      (thread.messages || []).forEach(message => {
        const item = document.createElement('article');
        const byline = document.createElement('small');
        byline.textContent = (message.author && (message.author.name || message.author.email) || 'Reviewer')
          + ' · ' + new Date(message.createdAt).toLocaleString();
        const body = document.createElement('p');
        body.textContent = message.body;
        item.append(byline, body);
        messages.appendChild(item);
      });
      this.popover.appendChild(messages);
    }

    positionPopover(thread) {
      const target = elementFor(thread.anchor);
      if (!target) {
        this.popover.style.left = '50%';
        this.popover.style.top = '50%';
        this.popover.style.transform = 'translate(-50%, -50%)';
        return;
      }
      /* Clamping the anchor point is not clamping the popover: an 18px inset on
         a point says nothing about the ~350×560 box hung off it, so a pin near
         the right or bottom edge put most of the thread outside the viewport.
         Measure the box, then place it — and when the side the box normally
         opens towards has run out, open it towards the other one instead of
         sliding it over its own pin. */
      const rect = target.getBoundingClientRect();
      const anchorX = rect.left + rect.width * anchorCoordinate(thread.anchor.rx);
      const anchorY = rect.top + rect.height * anchorCoordinate(thread.anchor.ry);
      const gap = 12;
      /* The gutter the layer keeps everywhere else — the toolbar's 18px inset,
         and the popover's own `calc(100vw - 36px)` width. One constant, used by
         both ends of both clamps: a zero floor (which is what the measured
         rewrite left behind) put a corner-anchored popover flush against the
         edge while the ceiling still inset it. */
      const gutter = 18;
      /* innerWidth counts a classic scrollbar as usable space, so clamping
         against it slides the box under one. clientWidth is what the page
         actually has. The same argument applies to the height — a horizontal
         scrollbar and the mobile URL bar both eat innerHeight — so both ends
         read the layout viewport, and the fallback is for a document with no
         element, which is what a minimal harness gives. */
      const root = document.documentElement;
      const viewWidth = (root && root.clientWidth) || global.innerWidth;
      const viewHeight = (root && root.clientHeight) || global.innerHeight;

      // Position first so the box has a layout to measure, then correct it. The
      // offset moves into left/top, so the transform is dropped: a translate
      // would move the measured result back out of the viewport.
      this.popover.style.left = anchorX + 'px';
      this.popover.style.top = anchorY + 'px';
      this.popover.style.transform = 'none';
      const box = this.popover.getBoundingClientRect();

      let left = anchorX - gap;
      if (left + box.width > viewWidth - gutter) left = anchorX - box.width + gap;
      let top = anchorY + gap;
      if (top + box.height > viewHeight - gutter) top = anchorY - box.height - gap;

      // A box too large to satisfy both insets keeps the leading one: the head
      // of a thread is what has to be readable, and the popover scrolls.
      this.popover.style.left = Math.max(gutter, Math.min(left, viewWidth - box.width - gutter)) + 'px';
      this.popover.style.top = Math.max(gutter, Math.min(top, viewHeight - box.height - gutter)) + 'px';
    }

    /* Two kinds of link live here and they must not share a base.
       In-page navigation — history.replaceState, location.assign and the
       needsRestore comparison that decides between them — has to resolve
       against the origin the reviewer is actually on: replaceState throws
       SecurityError on a cross-origin URL and aborts its caller mid-method, and
       assigning one would walk a reviewer off their local copy onto the
       published site, where the layer may not even be configured. Only a link
       meant to be handed to someone else carries config.prototypeUrl. */
    pageBase() {
      return httpUrl(location.href) || new URL(location.href);
    }

    shareBase() {
      return httpUrl(this.config.prototypeUrl || location.href) || this.pageBase();
    }

    /* The one place prototypeUrl belongs: an absolute link the reviewer pastes
       to somebody else. It is never fed to history or to location. */
    shareLink(thread) {
      return this.deepLink(thread, this.shareBase());
    }

    deepLink(thread, base) {
      const anchor = thread.anchor || {};
      const state = readableAnchorState(anchor);
      const root = base || this.pageBase();
      const carried = global.protoTools && typeof global.protoTools.carryQS === 'function'
        ? global.protoTools.carryQS(Object.keys(state))
        : '';
      // The whole reference is validated, not anchor.page alone: what reaches
      // location.assign is the resolved concatenation. A refused anchor falls
      // back to the page being viewed, which is derived from location and never
      // from the store, so the fallback cannot be steered.
      const url = navigableUrl((anchor.page || pageName()) + carried, root)
        || new URL(pageName() + carried, root);
      Object.keys(state).sort().forEach(key => url.searchParams.set(key, state[key]));
      if (anchor.lang) url.searchParams.set('lang', anchor.lang);
      if (anchor.viewport) url.searchParams.set('viewport', anchor.viewport);
      url.hash = 'c=' + encodeURIComponent(thread.id);
      return url;
    }

    needsRestore(thread) {
      const anchor = thread.anchor || {};
      const base = this.pageBase();
      if (pagePath(base) !== safePagePath(anchor.page, base)) return true;
      const state = readableAnchorState(anchor);
      if (Object.keys(state).some(key => qp.get(key) !== String(state[key]))) return true;
      return Boolean(anchor.lang && qp.get('lang') !== anchor.lang)
        || Boolean(anchor.viewport && qp.get('viewport') !== anchor.viewport);
    }

    async openThread(thread) {
      if (this.needsRestore(thread)) {
        location.assign(this.deepLink(thread).href);
        return;
      }
      // The address bar is a convenience, never a precondition. A refused
      // replaceState — a sandboxed document, a history quota, a base this
      // origin may not write — must degrade to "the URL was not updated", not
      // to a thread that never renders.
      try {
        history.replaceState(null, '', this.deepLink(thread).href);
      } catch (error) {
        note('deep link not written to history: ' + (error && error.message || String(error)));
      }
      const target = elementFor(thread.anchor);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        target.classList.add('proto-comment-target');
        global.setTimeout(() => target.classList.remove('proto-comment-target'), 1600);
      }
      const detail = (await privateLoadThreadDetail(this.store, thread.id, this.capabilities)) || thread;
      if (detail !== thread) this.setThreads([detail], true);
      this.showComposer(detail);
    }

    openHashThread() {
      const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
      const id = hash.get('c');
      if (!id) return;
      const thread = this.threads.find(item => item.id === id);
      if (!thread) return;
      this.deepLinkHandled = true;
      this.openThread(thread).catch(error => this.showError('This comment could not be opened.', error));
    }

    showError(message, cause) {
      this.cleanupSelection();
      note(message);
      // The reviewer gets the sentence; the console gets the cause. Swallowing it
      // made a Firestore rule rejection and a missing document look identical.
      if (cause && global.console && global.console.error) {
        global.console.error('[proto-comments] cause:', (cause && cause.code) || '', cause);
      }
      if (!this.popover) return;
      this.popover.hidden = false;
      this.activeThread = null; // Prevent positionPins from moving the error popover
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'pc-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close error');
      close.onclick = () => {
        this.cleanupSelection();
        this.popover.hidden = true;
      };
      const header = document.createElement('header');
      header.appendChild(close);
      const error = document.createElement('p');
      error.className = 'pc-error';
      error.textContent = message;
      this.popover.replaceChildren(header, error);
      // An error popover left unpositioned inherits the last thread's coordinates,
      // which on a long page put it thousands of pixels below the fold — the
      // reviewer then saw a pin that did nothing at all.
      this.popover.style.left = '50%';
      this.popover.style.top = '50%';
      this.popover.style.transform = 'translate(-50%, -50%)';
    }
  }

  async function init(input) {
    // This must be the first effect: Figma/export captures have no comment UI.
    if (EXPORT) return null;
    if (location.protocol === 'file:') {
      note('disabled on file://; open the published prototype to sign in.');
      return null;
    }
    const options = optionBag(input);
    try {
      const config = await loadCommentsConfig(options);
      if (!config) {
        note('no comments.config.json; comment layer not started.');
        return null;
      }
      const layer = new CommentLayer(config, options);
      await layer.start();
      return layer;
    } catch (error) {
      note('not started: ' + (error && error.message || 'configuration error'));
      return null;
    }
  }

  const api = { init: init };
  if (global.__PROTO_COMMENTS_TESTING__) {
    api.__test = {
      ANCHOR_FIELDS,
      ANCHOR_LIMITS,
      COMMENTS_CONFIG_FILE,
      COMMENTS_CONFIG_SCHEMA_FILE,
      CommentLayer,
      DELETE_BATCH_SIZE,
      DETAIL_CONCURRENCY,
      THREAD_PAGE_SIZE,
      anchorCoordinate,
      anchorFor,
      createFirebaseClient,
      deleteThread: privateDeleteThread,
      hasNextPage: privateHasNextPage,
      isAuthoritativeDeletionSnapshot,
      loadCommentsConfig,
      loadNextPage: privateLoadNextPage,
      loadThreadDetail: privateLoadThreadDetail,
      navigableUrl,
      optionBag,
      readableAnchorState,
      readOwnerRole: privateReadOwnerRole,
      registerStoreCapabilities: (store, capabilities) => {
        STORE_PRIVATE.set(store, capabilities);
        return store;
      },
      safePageName,
      safePagePath,
      selectorFor,
      subscribeAuthoritative: privateSubscribeAuthoritative,
      validateCommentAnchor,
      validateCommentsConfig,
    };
  }
  global.protoComments = api;
})(window);
