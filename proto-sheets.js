/* ============================================================
   PANEL CONTENT SHEETS — changelog, product use cases, comments
   ============================================================

   Three read-only sheets that hang off the demo panel: what changed between
   workshop rounds, what each demo state actually means as a product
   situation, and what the comments overview page is. They are content, not
   state axes, so nothing here writes to body.dataset, and the two fetched
   sheets fetch nothing until a reviewer opens them.

   One module serves both engines. The desktop panel (proto.js) and the mobile
   panel (proto-m.js) build different rows, but a sheet is the same object in
   both, so it lives here rather than being copied into each engine.

   Usage, from inside either panel builder, after the panel box is in the DOM:

     protoSheets.mount(box, { en: EN(), carry: qs() });

   Two files are generated:
     changelog.json      ← node tools/build-changelog.js   (after the commit)
     usecases.built.json ← node tools/build-usecases.js    (from usecases.json)

   fetch() cannot read a sibling file over file://, so from a local copy the
   two fetched sheets say so instead of failing silently. Serve the folder
   (node tools/serve.js) or use the published URL to read them. The comments
   sheet has no file to fetch — see addStaticSheet.

   A sheet is a preview, not the whole surface: the panel column is ~280 px
   wide and the changelog sheet is capped at CHANGELOG_LIMIT entries. Each
   sheet therefore carries a link to its full review page (changelog.html,
   usecases.html, comments.html — see proto-review.css for the shared shell),
   and the link is built outside the fetched content so it survives every
   failure path, including file://, where the sheet itself has nothing to
   show.                                                                  */

(function (global) {
  'use strict';

  const CHANGELOG_SRC = 'changelog.json';
  const USECASES_SRC = 'usecases.built.json';
  const USECASES_DOCS = 'docs/usecases.md';
  const CHANGELOG_PAGE = 'changelog.html';
  const USECASES_PAGE = 'usecases.html';
  const COMMENTS_PAGE = 'comments.html';
  const CHANGELOG_LIMIT = 25;

  /* Sheet chrome is prototype scaffolding, so it is labelled in both languages
     the prototype ships — the reviewer and the stakeholder are rarely the same
     reader, and neither should meet the other's language in the panel. */
  const T = {
    changelog: ['Jurnal de modificări', 'Changelog'],
    usecases: ['Situații de utilizare', 'Use cases'],
    comments: ['Comentarii pe prototip', 'Prototype comments'],
    commentsBody: [
      'Toate firele de discuție, grupate pe ecran, cu răspunsuri și stare. Cere autentificare, ca și pinurile de pe ecrane.',
      'Every comment thread, grouped by screen, with replies and status. Requires sign-in, like the pins on the screens.',
    ],
    needsUrl: ['Foaia se citește doar de pe adresa publicată.', 'This sheet needs the published URL.'],
    noFetch: ['Browserul nu poate încărca această foaie.', 'This browser cannot load this sheet.'],
    loading: ['Se încarcă…', 'Loading…'],
    unreadable: ['Foaia nu a putut fi citită.', 'This sheet could not be read.'],
    unloadable: ['Foaia nu a putut fi încărcată.', 'This sheet could not be loaded.'],
    badChangelog: ['Fișierul de jurnal este nevalid.', 'This changelog file is invalid.'],
    badUsecases: ['Fișierul de situații este nevalid.', 'This use-case file is invalid.'],
    emptyChangelog: ['Încă nu există intrări în jurnal.', 'No changelog entries yet.'],
    emptyUsecases: ['Încă nu există situații declarate.', 'No use cases yet.'],
    unreleased: ['Nepublicat', 'Unreleased'],
    unknownDate: ['Dată necunoscută', 'Unknown date'],
    untitled: ['Commit fără titlu', 'Untitled commit'],
    screens: ['Ecrane: ', 'Screens: '],
    openState: ['Deschide starea', 'Open this state'],
    storyRules: ['Poveste și reguli', 'Story and rules'],
    stateRef: ['Stările panoului', 'State reference'],
    readDocs: ['Documentația pentru dezvoltatori', 'Read developer use-case documentation'],
    fullPage: ['Deschide pagina întreagă →', 'Open the full page →'],
    noDoc: ['Fără documentație.', 'No documentation supplied.'],
  };

  function makeEl(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function sheetMessage(sheet, message) {
    sheet.textContent = '';
    sheet.appendChild(makeEl('p', 'pt-sheet-message', message));
  }

  /* Keep an entry's own parameters (the state a use case pins) and add only the
     carried panel parameters it did not already name for itself. */
  function withCarryQS(href, carried) {
    const raw = String(href || '');
    if (!carried) return raw;
    const hashAt = raw.indexOf('#');
    const beforeHash = hashAt === -1 ? raw : raw.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : raw.slice(hashAt);
    const queryAt = beforeHash.indexOf('?');
    const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
    const query = new URLSearchParams(queryAt === -1 ? '' : beforeHash.slice(queryAt + 1));
    new URLSearchParams(String(carried).replace(/^\?/, '')).forEach((value, key) => {
      if (!query.has(key)) query.set(key, value);
    });
    const serialized = query.toString();
    return path + (serialized ? '?' + serialized : '') + hash;
  }

  /* A generated deep link must open the interactive page even when the entry it
     came from was captured in export mode. */
  function withoutQueryParam(href, key) {
    const raw = String(href || '');
    const hashAt = raw.indexOf('#');
    const beforeHash = hashAt === -1 ? raw : raw.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : raw.slice(hashAt);
    const queryAt = beforeHash.indexOf('?');
    if (queryAt === -1) return raw;
    const path = beforeHash.slice(0, queryAt);
    const query = new URLSearchParams(beforeHash.slice(queryAt + 1));
    query.delete(key);
    const serialized = query.toString();
    return path + (serialized ? '?' + serialized : '') + hash;
  }

  function orderedEntries(entries) {
    return entries
      .map((entry, index) => ({ entry: entry || {}, index: index }))
      .sort((a, b) => {
        const aTime = Date.parse(a.entry.date || '');
        const bTime = Date.parse(b.entry.date || '');
        const aValid = Number.isFinite(aTime);
        const bValid = Number.isFinite(bTime);
        if (aValid && bValid && aTime !== bTime) return bTime - aTime;
        if (aValid !== bValid) return aValid ? -1 : 1;
        return a.index - b.index;
      })
      .map(item => item.entry);
  }

  function mount(box, opts) {
    opts = opts || {};
    if (!box) return;
    const en = !!opts.en;
    const carry = opts.carry || '';
    const t = key => T[key][en ? 1 : 0];

    const sheets = makeEl('div', 'pt-sheets');
    box.appendChild(sheets);
    let sheetNumber = 0;

    /* One lazy fetch-and-render path serves both sheets. The renderers below are
       data-specific; loading, failure and toggling are not. */
    function addContentSheet(options) {
      const sheetRow = makeEl('div', 'pt-row pt-sheet-row');
      const toggle = makeEl('button', 'pt-sheet-toggle', options.title);
      const sheet = makeEl('section', 'pt-sheet');
      /* Sits beside the sheet, not inside it: a renderer clears the sheet on
         every draw, and the way out must also exist when the draw failed. */
      const pageLink = makeEl('a', 'pt-sheet-page', t('fullPage'));
      const sheetId = 'pt-sheet-' + (++sheetNumber);
      let requested = false;

      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', sheetId);
      sheet.id = sheetId;
      sheet.hidden = true;
      pageLink.href = options.page;
      pageLink.hidden = true;
      sheetRow.appendChild(toggle);
      sheetRow.appendChild(sheet);
      sheetRow.appendChild(pageLink);
      sheets.appendChild(sheetRow);

      toggle.onclick = () => {
        const opening = sheet.hidden;
        sheet.hidden = !opening;
        pageLink.hidden = !opening;
        toggle.setAttribute('aria-expanded', String(opening));
        if (!opening || requested) return;

        requested = true;
        if (location.protocol === 'file:') { sheetMessage(sheet, t('needsUrl')); return; }
        if (typeof global.fetch !== 'function') { sheetMessage(sheet, t('noFetch')); return; }

        sheetMessage(sheet, t('loading'));
        global.fetch(options.src)
          .then(response => {
            if (response && response.ok === false) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(data => {
            try { options.render(sheet, data); }
            catch (error) { sheetMessage(sheet, t('unreadable')); }
          })
          .catch(() => sheetMessage(sheet, t('unloadable')));
      };
    }

    /* The comments overview has no changelog-like data for this sheet to
       fetch and list — the layer's own toolbar (proto-comments.js) is where
       a live count belongs. So this sheet skips the fetch-and-render path
       addContentSheet drives and just states what the page is, built once at
       mount rather than lazily on toggle. The page link still sits beside
       the sheet, not inside it, for the exact reason addContentSheet's does:
       the way out must survive every draw and every failure path, including
       file://, where there is nothing to fetch here anyway. */
    function addStaticSheet(options) {
      const sheetRow = makeEl('div', 'pt-row pt-sheet-row');
      const toggle = makeEl('button', 'pt-sheet-toggle', options.title);
      const sheet = makeEl('section', 'pt-sheet');
      const pageLink = makeEl('a', 'pt-sheet-page', t('fullPage'));
      const sheetId = 'pt-sheet-' + (++sheetNumber);

      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', sheetId);
      sheet.id = sheetId;
      sheet.hidden = true;
      sheet.appendChild(makeEl('p', 'pt-sheet-message', options.body));
      pageLink.href = options.page;
      pageLink.hidden = true;
      sheetRow.appendChild(toggle);
      sheetRow.appendChild(sheet);
      sheetRow.appendChild(pageLink);
      sheets.appendChild(sheetRow);

      toggle.onclick = () => {
        const opening = sheet.hidden;
        sheet.hidden = !opening;
        pageLink.hidden = !opening;
        toggle.setAttribute('aria-expanded', String(opening));
      };
    }

    function renderChangelog(sheet, data) {
      const entries = data && Array.isArray(data.entries) ? data.entries : null;
      if (!entries) { sheetMessage(sheet, t('badChangelog')); return; }

      const visible = orderedEntries(entries).slice(0, CHANGELOG_LIMIT);
      sheet.textContent = '';
      if (!visible.length) { sheet.appendChild(makeEl('p', 'pt-sheet-message', t('emptyChangelog'))); return; }

      const hasRounds = visible.some(entry => entry.round);
      let previousRound;
      visible.forEach(entry => {
        const round = entry.round || t('unreleased');
        if (hasRounds && round !== previousRound) {
          sheet.appendChild(makeEl('h3', 'pt-sheet-heading', round));
          previousRound = round;
        }

        const item = makeEl('article', 'pt-change');
        const meta = makeEl('div', 'pt-change-meta');
        meta.appendChild(document.createTextNode(entry.date || t('unknownDate')));
        meta.appendChild(document.createTextNode(' · '));
        meta.appendChild(document.createTextNode(entry.subject || t('untitled')));
        meta.appendChild(document.createTextNode(' · '));
        const short = entry.short || (entry.sha ? String(entry.sha).slice(0, 7) : 'commit');
        if (entry.url) {
          const commit = makeEl('a', 'pt-commit', short);
          commit.href = entry.url;
          commit.target = '_blank';
          commit.rel = 'noreferrer';
          meta.appendChild(commit);
        } else {
          meta.appendChild(makeEl('span', 'pt-commit', short));
        }
        item.appendChild(meta);

        const screens = Array.isArray(entry.screens) ? entry.screens : [];
        if (screens.length) {
          const screenList = makeEl('div', 'pt-sheet-links');
          screenList.appendChild(document.createTextNode(t('screens')));
          let rendered = 0;
          screens.forEach(screen => {
            const label = typeof screen === 'string' ? screen : screen && (screen.screen || screen.label);
            const href = typeof screen === 'string' ? screen : screen && (screen.href || screen.screen);
            if (!label || !href) return;
            if (rendered++) screenList.appendChild(document.createTextNode(', '));
            const link = makeEl('a', '', label);
            link.href = withCarryQS(href, carry);
            screenList.appendChild(link);
          });
          if (rendered) item.appendChild(screenList);
        }
        sheet.appendChild(item);
      });
    }

    function stateOptionLine(axisLabel, option, value) {
      const line = makeEl('div', 'pt-state-doc');
      line.appendChild(makeEl('strong', '', axisLabel + ' · ' + ((option && option.label) || value) + ': '));
      line.appendChild(document.createTextNode((option && option.doc) || t('noDoc')));
      return line;
    }

    /* Every declared axis is listed in the sheet rather than injected under its
       own switch row: the two panels build different rows, and several rows are
       conditional on the page, so a sheet section is the one place a state's
       meaning is always readable — including for an axis whose row is absent
       from the screen the reviewer happens to be on. */
    function renderStateDocs(states, sheet) {
      const declared = states && typeof states === 'object' ? states : {};
      const keys = Object.keys(declared);
      if (!keys.length) return;
      const reference = makeEl('div', 'pt-state-reference');
      reference.appendChild(makeEl('h3', 'pt-sheet-heading', t('stateRef')));
      keys.forEach(key => {
        const state = declared[key] || {};
        const axisLabel = state.label || key;
        const section = makeEl('div', 'pt-state-reference-item');
        section.appendChild(makeEl('strong', '', axisLabel));
        if (state.doc) section.appendChild(makeEl('p', '', state.doc));
        Object.keys(state.options || {}).forEach(value => {
          section.appendChild(stateOptionLine(axisLabel, state.options[value] || {}, value));
        });
        reference.appendChild(section);
      });
      sheet.appendChild(reference);
    }

    function renderUsecases(sheet, data) {
      const items = data && Array.isArray(data.usecases) ? data.usecases : null;
      if (!items) { sheetMessage(sheet, t('badUsecases')); return; }

      sheet.textContent = '';
      if (!items.length) sheet.appendChild(makeEl('p', 'pt-sheet-message', t('emptyUsecases')));
      items.forEach(usecase => {
        const item = makeEl('article', 'pt-usecase');
        const title = makeEl('h3', 'pt-usecase-title');
        title.appendChild(makeEl('span', 'pt-usecase-id', usecase.id || 'Use case'));
        title.appendChild(document.createTextNode(' · ' + (usecase.name || '')));
        item.appendChild(title);

        const state = usecase.state && typeof usecase.state === 'object' ? usecase.state : {};
        const stateLine = Object.keys(state).map(key => {
          const definition = data.states && data.states[key];
          const option = definition && definition.options && definition.options[state[key]];
          return ((definition && definition.label) || key) + ': ' + ((option && option.label) || state[key]);
        }).join(' · ');
        if (stateLine) item.appendChild(makeEl('p', 'pt-usecase-state', stateLine));

        const deepLink = withoutQueryParam(usecase.deepLink || '', 'nopanel');
        if (deepLink) {
          const open = makeEl('a', 'pt-usecase-open', t('openState'));
          open.href = deepLink;
          item.appendChild(open);
        }

        const screens = Array.isArray(usecase.screens) ? usecase.screens : [];
        if (screens.length) {
          const screenList = makeEl('div', 'pt-sheet-links');
          screenList.appendChild(document.createTextNode(t('screens')));
          let rendered = 0;
          screens.forEach(screen => {
            const label = typeof screen === 'string' ? screen : screen && (screen.screen || screen.label);
            const href = typeof screen === 'string' ? screen : screen && (screen.deepLink || screen.href || screen.screen);
            if (!label || !href) return;
            if (rendered++) screenList.appendChild(document.createTextNode(', '));
            const link = makeEl('a', '', label + (screen && screen.viewport ? ' (' + screen.viewport + ')' : ''));
            link.href = withoutQueryParam(href, 'nopanel');
            screenList.appendChild(link);
          });
          if (rendered) item.appendChild(screenList);
        }

        if (usecase.story || (Array.isArray(usecase.rules) && usecase.rules.length)) {
          const details = makeEl('details', 'pt-usecase-notes');
          details.appendChild(makeEl('summary', '', t('storyRules')));
          if (usecase.story) details.appendChild(makeEl('p', '', usecase.story));
          if (Array.isArray(usecase.rules) && usecase.rules.length) {
            const rules = makeEl('ul', 'pt-usecase-rules');
            usecase.rules.forEach(rule => rules.appendChild(makeEl('li', '', rule)));
            details.appendChild(rules);
          }
          item.appendChild(details);
        }
        sheet.appendChild(item);
      });

      const docs = makeEl('a', 'pt-usecase-docs', t('readDocs'));
      docs.href = USECASES_DOCS;
      sheet.appendChild(docs);
      renderStateDocs(data.states, sheet);
    }

    addContentSheet({ src: CHANGELOG_SRC, page: CHANGELOG_PAGE, title: t('changelog'), render: renderChangelog });
    addContentSheet({ src: USECASES_SRC, page: USECASES_PAGE, title: t('usecases'), render: renderUsecases });
    addStaticSheet({ page: COMMENTS_PAGE, title: t('comments'), body: t('commentsBody') });
  }

  global.protoSheets = { mount: mount };
})(window);
