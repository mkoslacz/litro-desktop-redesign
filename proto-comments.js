/* ============================================================
   Prototype · stakeholder comments
   ------------------------------------------------------------
   This is deliberately a second, opt-in IIFE beside proto-tools.
   Publish comments.config.json and comments.config.schema.json, then load
   proto-tools.js and this file after protoTools.init(...). A prototype with no
   config keeps behaving
   as a plain, file://-openable static page.

   The browser store deliberately exposes only five operations:
   list, subscribe, add, reply and resolve. Firebase is the default
   implementation; replacing createFirebaseClient is the swap seam.
   ============================================================ */
(function (global) {
  'use strict';

  const qp = new URLSearchParams(location.search);
  const EXPORT = qp.has('nopanel');
  const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const COMMENTS_CONFIG_FILE = 'comments.config.json';
  const COMMENTS_CONFIG_SCHEMA_FILE = 'comments.config.schema.json';
  const THREAD_PAGE_SIZE = 50;
  const DETAIL_CONCURRENCY = 4;
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
    if (input.config || input.schema || input.store || input.user || input.signIn || input.fetchConfig || input.configUrl || input.schemaUrl || input.createFirebaseClient) return input;
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
    return 'body > ' + parts.join(' > ');
  }

  function selectorFor(element) {
    if (element.hasAttribute && element.hasAttribute('data-c')) {
      const value = element.getAttribute('data-c');
      if (value) return { selector: '[data-c="' + escapeCss(value) + '"]', selectorKind: 'data' };
      return { selector: '[data-c]', selectorKind: 'data' };
    }
    if (element.id) return { selector: '#' + escapeCss(element.id), selectorKind: 'id' };
    return { selector: nthPath(element), selectorKind: 'path' };
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
    const rect = element.getBoundingClientRect();
    const selector = selectorFor(element);
    const clientX = event && event.clientX != null ? event.clientX : rect.left + rect.width / 2;
    const clientY = event && event.clientY != null ? event.clientY : rect.top + rect.height / 2;
    const viewport = config.viewport || document.body.dataset.viewport || (/^m[-.]/.test(pageName()) ? 'mobile' : 'desktop');
    return {
      page: pageName(),
      viewport: viewport === 'mobile' ? 'mobile' : 'desktop',
      lang: document.documentElement.lang || config.lang || 'und',
      state: stateFromBody(config),
      selector: selector.selector,
      selectorKind: selector.selectorKind,
      rx: rect.width ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0.5,
      ry: rect.height ? Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) : 0.5,
      label: labelFor(element),
      text: text(element.innerText || element.textContent),
    };
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
            const firstPageCursor = docs.length === THREAD_PAGE_SIZE ? cursorFor(docs[docs.length - 1]) : null;
            if (!loadedBeyondFirstPage) nextCursor = firstPageCursor;
            onChange(docs.map(threadSummary).sort(compareByTimestampThenId));
          } catch (error) {
            if (onError) onError(error);
          }
        }, onError);
      },
      add: async function add(thread, message) {
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
          anchor: thread.anchor,
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

    // The five-method adapter stays public. This private detail persists the
    // layer-owned orphan marker without making a sixth backend contract method.
    STORE_PRIVATE.set(commentsStore, {
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
      setOrphaned: (threadId, orphaned) => dbApi.updateDoc(dbApi.doc(threads, threadId), {
        orphaned: Boolean(orphaned),
        updatedAt: new Date().toISOString(),
      }),
    });

    return {
      store: commentsStore,
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

  function privateHasNextPage(store) {
    const details = STORE_PRIVATE.get(store);
    return Boolean(details && details.hasNextPage());
  }

  function privateLoadNextPage(store) {
    const details = STORE_PRIVATE.get(store);
    return details ? details.loadNextPage() : Promise.resolve([]);
  }

  function privateLoadThreadDetail(store, threadId) {
    const details = STORE_PRIVATE.get(store);
    return details ? details.loadThreadDetail(threadId) : Promise.resolve(null);
  }

  class CommentLayer {
    constructor(config, options) {
      this.config = config;
      this.options = options;
      this.store = options.store || null;
      this.client = null;
      this.user = options.user || null;
      this.threads = [];
      this.hasNextPage = false;
      this.showResolved = false;
      this.activeThread = null;
      this.unsubscribe = null;
      this.deepLinkHandled = false;
      this.toolbar = null;
      this.tray = null;
      this.popover = null;
      this.positionPins = this.positionPins.bind(this);
    }

    async start() {
      this.buildShell();
      if (!this.store) {
        this.client = await (this.options.createFirebaseClient || createFirebaseClient)(this.config);
        this.store = this.client.store;
        this.client.observeUser(user => this.setUser(user));
      } else {
        this.setUser(this.user);
      }
      global.addEventListener('resize', this.positionPins);
      global.addEventListener('scroll', this.positionPins, true);
    }

    buildShell() {
      this.toolbar = document.createElement('aside');
      this.toolbar.className = 'proto-comments-tools';
      this.toolbar.setAttribute('aria-label', 'Prototype comments');
      this.toolbar.innerHTML = '<button type="button" class="pc-signin">Sign in to comment</button>'
        + '<button type="button" class="pc-add" disabled>Add comment</button>'
        + '<button type="button" class="pc-more" hidden>Load older comments</button>'
        + '<label class="pc-filter"><input type="checkbox"> Show resolved</label>';
      this.tray = document.createElement('aside');
      this.tray.className = 'proto-comments-tray';
      this.tray.hidden = true;
      this.popover = document.createElement('section');
      this.popover.className = 'proto-comments-popover';
      this.popover.hidden = true;
      document.body.append(this.toolbar, this.tray, this.popover);
      $('.pc-signin', this.toolbar).onclick = () => this.signIn();
      $('.pc-add', this.toolbar).onclick = () => this.beginSelection();
      $('.pc-more', this.toolbar).onclick = () => this.loadOlderThreads();
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
      this.user = user || null;
      const signedIn = Boolean(this.user);
      $('.pc-signin', this.toolbar).hidden = signedIn;
      $('.pc-add', this.toolbar).disabled = !signedIn;
      if (signedIn && this.store) this.loadThreads();
    }

    async loadThreads() {
      try {
        this.setThreads(await this.store.list());
        this.hasNextPage = privateHasNextPage(this.store);
        this.updateLoadMoreControl();
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = this.store.subscribe(threads => {
          this.setThreads(threads, true);
          this.hasNextPage = privateHasNextPage(this.store);
          this.updateLoadMoreControl();
        }, error => this.showError(error && error.message || 'Subscription error', error));
      } catch (error) {
        this.showError('Comments are unavailable. Confirm that this account is allowed to review this prototype.', error);
      }
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
      this.renderThreads();
      if (!this.deepLinkHandled) this.openHashThread();
    }

    async loadOlderThreads() {
      try {
        const older = await privateLoadNextPage(this.store);
        this.setThreads(older, true);
        this.hasNextPage = privateHasNextPage(this.store);
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
       resolving, exactly as deepLink and needsRestore judge it. */
    belongsToThisPage(thread) {
      const anchor = (thread && thread.anchor) || {};
      // Absent page: a thread stored before the field existed. deepLink already
      // reads that as "the page being viewed", so it renders here.
      if (!anchor.page) return true;
      const url = navigableUrl(anchor.page, this.pageBase());
      // A value that will not resolve to a navigable same-origin URL names no
      // page of this prototype, so it is nobody's pin.
      return Boolean(url) && fileNameOf(url.pathname) === pageName();
    }

    renderThreads() {
      $$('.proto-comment-pin').forEach(pin => pin.remove());
      const detached = [];
      this.threads.filter(thread => this.belongsToThisPage(thread)).forEach(thread => {
        const target = elementFor(thread.anchor);
        if (!target) {
          detached.push(thread);
          if (!thread.orphaned) privateOrphanUpdate(this.store, thread.id, true).catch(() => {});
          return;
        }
        if (thread.orphaned) privateOrphanUpdate(this.store, thread.id, false).catch(() => {});
        if (thread.status === 'resolved' && !this.showResolved) return;
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'proto-comment-pin' + (thread.status === 'resolved' ? ' resolved' : '');
        pin.dataset.threadId = thread.id;
        pin.setAttribute('aria-label', 'Open comment: ' + (thread.anchor && thread.anchor.label || 'comment'));
        pin.textContent = thread.status === 'resolved' ? '✓' : '●';
        pin.onclick = () => this.openThread(thread).catch(error => this.showError('This comment could not be opened.', error));
        document.body.appendChild(pin);
        this.positionPin(pin, target, thread.anchor);
      });
      this.renderDetached(detached);
      this.positionPins();
    }

    positionPin(pin, target, anchor) {
      const rect = target.getBoundingClientRect();
      pin.style.left = (rect.left + rect.width * (Number(anchor.rx) || 0.5)) + 'px';
      pin.style.top = (rect.top + rect.height * (Number(anchor.ry) || 0.5)) + 'px';
    }

    positionPins() {
      $$('.proto-comment-pin').forEach(pin => {
        const thread = this.threads.find(item => item.id === pin.dataset.threadId);
        const target = thread && elementFor(thread.anchor);
        if (thread && target) this.positionPin(pin, target, thread.anchor);
      });
      if (this.activeThread && !this.popover.hidden) this.positionPopover(this.activeThread);
    }

    renderDetached(threads) {
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
      document.body.dataset.commenting = '1';
      this.showComposer(null, null, 'Click the place this comment is about.');
      const select = event => {
        if (event.target.closest('.proto-comments-tools, .proto-comments-tray, .proto-comments-popover, .proto-comment-pin')) return;
        event.preventDefault();
        event.stopPropagation();
        document.body.removeAttribute('data-commenting');
        document.removeEventListener('click', select, true);
        this.showComposer(null, anchorFor(event.target, event, this.config));
      };
      document.addEventListener('click', select, true);
    }

    showComposer(thread, anchor, hint) {
      this.activeThread = thread || null;
      this.popover.hidden = false;
      this.popover.replaceChildren();
      const heading = document.createElement('strong');
      heading.textContent = thread ? (thread.anchor && thread.anchor.label || 'Comment') : (hint || 'New comment');
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'pc-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close comment');
      close.onclick = () => { this.popover.hidden = true; this.activeThread = null; };
      const header = document.createElement('header');
      header.append(heading, close);
      this.popover.appendChild(header);

      if (thread) this.renderMessages(thread);
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
          else await this.store.add({ createdBy: actor(this.user), anchor: anchor }, { author: actor(this.user), body: body, agent: false });
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
      this.popover.append(box, actions);
      if (thread) this.positionPopover(thread);
      else {
        this.popover.style.left = '50%';
        this.popover.style.top = '50%';
        this.popover.style.transform = 'translate(-50%, -50%)';
      }
      box.focus();
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
      const rect = target.getBoundingClientRect();
      const anchorX = rect.left + rect.width * (Number(thread.anchor.rx) || 0.5);
      const anchorY = rect.top + rect.height * (Number(thread.anchor.ry) || 0.5);

      // Measure popover dimensions to clamp properly. Set initial position first
      // so getBoundingClientRect works, then adjust based on actual size.
      this.popover.style.left = anchorX + 'px';
      this.popover.style.top = anchorY + 'px';
      this.popover.style.transform = 'translate(-12px, 12px)';

      const popoverRect = this.popover.getBoundingClientRect();
      const popoverWidth = popoverRect.width;
      const popoverHeight = popoverRect.height;
      const offset = 12; // From translate(-12px, 12px)

      // Clamp left: ensure popover stays within viewport
      let left = anchorX - offset;
      if (left + popoverWidth > global.innerWidth) {
        // Not enough space on right, flip to left side
        left = Math.max(0, anchorX - popoverWidth + offset);
      }
      left = Math.max(0, Math.min(left, global.innerWidth - popoverWidth));

      // Clamp top: ensure popover stays within viewport
      let top = anchorY + offset;
      if (top + popoverHeight > global.innerHeight) {
        // Not enough space below, flip to above
        top = Math.max(0, anchorY - popoverHeight - offset);
      }
      top = Math.max(0, Math.min(top, global.innerHeight - popoverHeight));

      this.popover.style.left = left + 'px';
      this.popover.style.top = top + 'px';
      this.popover.style.transform = 'none';
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
      const root = base || this.pageBase();
      const carried = global.protoTools && typeof global.protoTools.carryQS === 'function'
        ? global.protoTools.carryQS(Object.keys(anchor.state || {}))
        : '';
      // The whole reference is validated, not anchor.page alone: what reaches
      // location.assign is the resolved concatenation. A refused anchor falls
      // back to the page being viewed, which is derived from location and never
      // from the store, so the fallback cannot be steered.
      const url = navigableUrl((anchor.page || pageName()) + carried, root)
        || new URL(pageName() + carried, root);
      Object.keys(anchor.state || {}).sort().forEach(key => url.searchParams.set(key, anchor.state[key]));
      if (anchor.lang) url.searchParams.set('lang', anchor.lang);
      if (anchor.viewport) url.searchParams.set('viewport', anchor.viewport);
      url.hash = 'c=' + encodeURIComponent(thread.id);
      return url;
    }

    needsRestore(thread) {
      const anchor = thread.anchor || {};
      if (pageName() !== safePageName(anchor.page, this.pageBase())) return true;
      const state = anchor.state || {};
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
      const detail = (await privateLoadThreadDetail(this.store, thread.id)) || thread;
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
      close.onclick = () => { this.popover.hidden = true; };
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
      COMMENTS_CONFIG_FILE,
      COMMENTS_CONFIG_SCHEMA_FILE,
      CommentLayer,
      DETAIL_CONCURRENCY,
      THREAD_PAGE_SIZE,
      createFirebaseClient,
      hasNextPage: privateHasNextPage,
      loadCommentsConfig,
      loadNextPage: privateLoadNextPage,
      loadThreadDetail: privateLoadThreadDetail,
      navigableUrl,
      safePageName,
      validateCommentsConfig,
    };
  }
  global.protoComments = api;
})(window);
