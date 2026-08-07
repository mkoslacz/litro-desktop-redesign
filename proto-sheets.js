/* ============================================================
   PANEL REVIEW NAVIGATION — changelog, use cases, comments
   ============================================================

   One module serves both panel engines. It renders ordinary links to the
   complete reviewer pages; those pages remain the only place that renders
   their document content.

   Usage, from inside either panel builder, after the panel box is in the DOM:

     protoSheets.mount(box, { en: EN(), carry: qs() });

   `en` is accepted for API compatibility. Reviewer-facing panel chrome is
   always English. Targets remain local page paths, not published share URLs. */

(function (global) {
  'use strict';

  const PAGE_DEFAULTS = [
    { key: 'changelog', href: 'changelog.html', label: 'Changelog', ariaLabel: 'Open the changelog review page' },
    { key: 'usecases', href: 'usecases.html', label: 'Use cases', ariaLabel: 'Open the use cases review page' },
    { key: 'comments', href: 'comments.html', label: 'Comments', ariaLabel: 'Open the comments review page' },
  ];

  function makeEl(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  /* All page entries accept the same compact override shapes. The normal
     mount path uses the defaults, while an object or string can supply a
     future target without creating a second rendering path. */
  function pageLinkConfig(value, defaults) {
    if (typeof value === 'string') return Object.assign({}, defaults, { href: value });
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.assign({}, defaults, value, { href: value.href || defaults.href });
    }
    return Object.assign({}, defaults);
  }

  /* Keep the target page's own parameters and fragment. Current panel state
     is added only for keys the target did not already define. */
  function withCarryQS(href, carried) {
    const raw = String(href || '');
    if (!carried) return raw;
    const hashAt = raw.indexOf('#');
    const beforeHash = hashAt === -1 ? raw : raw.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : raw.slice(hashAt);
    const queryAt = beforeHash.indexOf('?');
    const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
    const query = new URLSearchParams(queryAt === -1 ? '' : beforeHash.slice(queryAt + 1));
    const occupied = new Set(query.keys());

    const sources = Array.isArray(carried) ? carried : [carried];
    sources.forEach(source => {
      const sourceKeys = new Set();
      new URLSearchParams(String(source || '').replace(/^\?/, '')).forEach((value, key) => {
        if (!occupied.has(key)) query.append(key, value);
        sourceKeys.add(key);
      });
      sourceKeys.forEach(key => occupied.add(key));
    });

    const serialized = query.toString();
    return path + (serialized ? '?' + serialized : '') + hash;
  }

  function mount(box, opts) {
    opts = opts || {};
    if (!box) return;

    const pages = PAGE_DEFAULTS.map(defaults => {
      const configured = Object.prototype.hasOwnProperty.call(opts, defaults.key)
        ? opts[defaults.key]
        : true;
      return pageLinkConfig(configured, defaults);
    });
    /* The page's real query string contains panel axes that the engines' qs()
       helpers do not. Read it first, then add any generated search state that
       is not already present. */
    const currentQuery = global.location && global.location.search || '';
    const carry = [currentQuery, opts.carry || ''];
    const navigation = makeEl('nav', 'pt-review-pages');
    navigation.setAttribute('aria-label', 'Review pages');

    pages.forEach(page => {
      const row = makeEl('div', 'pt-row pt-review-page-row');
      const link = makeEl('a', 'pt-review-page-link', page.label);
      link.href = withCarryQS(page.href, carry);
      link.setAttribute('aria-label', page.ariaLabel);
      row.appendChild(link);
      navigation.appendChild(row);
    });

    box.appendChild(navigation);
  }

  global.protoSheets = { mount: mount };
})(window);
