/* ============================================================
   LITRO desktop prototype — interaction engine
   Progressive enhancement over the static screens.
   State lives in localStorage + the URL, so the click-through
   carries destination / dates / guests / hotel / rate across pages.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  /* fluxul principal (varianta C) merge la listing-c; restul (arhivate) la listing.html */
  /* limbă: pe paginile EN (<html lang="en">) navigarea merge la variantele „-en" */
  const EN = () => document.documentElement.lang === 'en';
  const en = (n) => EN() ? n.replace('.html', '-en.html') : n;
  const listingHref = () => en(document.body.dataset.variant === 'c' || document.body.dataset.listing === 'c' ? 'listing-c.html' : 'listing.html');
  const MON = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const monN = i => EN() ? MON_EN[i] : MON[i];   // lună scurtă, în funcție de limbă
  const guestsTxt = () => EN()
    ? S.adults + ' adult' + (S.adults === 1 ? '' : 's') + (S.kids ? ' + ' + S.kids + ' child' + (S.kids === 1 ? '' : 'ren') : '')
    : S.adults + (S.adults === 1 ? ' adult' : ' adulți') + (S.kids ? ' + ' + S.kids + (S.kids === 1 ? ' copil' : ' copii') : '');
  const DOW = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
  const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const pad = n => (n < 10 ? '0' : '') + n;
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const TODAY = new Date(2026, 4, 20); // prototype 'today' — keeps the June demo stay bookable
  const parse = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const nightsBetween = (a, b) => Math.max(1, Math.round((parse(b) - parse(a)) / 864e5));
  const fmtShort = s => { const d = parse(s); return d.getDate() + ' ' + monN(d.getMonth()); };
  const fmtRange = (a, b) => fmtShort(a) + ' – ' + fmtShort(b);

  /* Câte rezultate intră pe o pagină. Se schimbă din panoul de prototip (10/20/30),
     pentru că e o decizie de produs, nu o constantă: pagina scurtă aduce paginarea
     în primul ecran, cea lungă amână decizia. Lista are întotdeauna MAX_PAGE carduri
     în DOM (vezi fillListingPage), iar PAGE_SIZE decide doar câte se văd. */
  const PAGE_SIZES = [10, 20, 30];
  const MAX_PAGE = 30;
  let PAGE_SIZE = 30;
  let listingRepaint = null;     // = applyFilters, setat de initListing

  /* Tipul de pagină pentru comutatoarele de prototip. Nu e același lucru cu
     data-page: home-d ARE listingul în pagină (data-page="listing"), dar pentru
     bara de căutare lipită contează că e homepage. */
  const FILE = (location.pathname.split('/').pop() || 'index.html').replace('-en.html', '.html');
  const PAGEKIND = () => /^home/.test(FILE) ? 'home' : (document.body.dataset.page || '');
  const STICKY_KEY = { home: 'stickyHome', listing: 'stickyList', hotel: 'stickyHotel' };
  const STICKY_URL = [['sthome', 'stickyHome'], ['stlist', 'stickyList'], ['sthotel', 'stickyHotel']];
  const STICKY_PARAM = { stickyHome: 'sthome', stickyList: 'stlist', stickyHotel: 'sthotel' };
  const setUrlState = (key, value) => { document.body.dataset[key] = String(value); };
  const setStickyState = (param, key, value) => {
    document.body.dataset[key] = value;
    setUrlState(param, value);
  };
  let stickySync = null;      // setat de bara lipită; comutatoarele din panou îl re-rulează
  let ssUserPaint = null;     // eticheta „musafir / Ana" din bara lipită

  /* '' = tot litoralul: căutarea implicită merge peste toate stațiunile deodată,
     nu una câte una — așa vede utilizatorul întâi oferta, apoi alege zona */
  const ALL_TOTAL = 1236;
  const destLabel = () => S.dest || (EN() ? 'All resorts' : 'Tot litoralul');

  const RESORTS = [
    ['Mamaia', 319], ['Mamaia Nord', 58], ['Eforie Nord', 184], ['Eforie Sud', 76], ['Costinești', 97],
    ['Neptun-Olimp', 112], ['Jupiter', 64], ['Venus', 71], ['Saturn', 49], ['Mangalia', 38],
    ['Constanța', 84], ['Vama Veche 2 Mai', 64], ['Techirghiol', 21], ['Năvodari', 18], ['Tuzla', 9],
    ['Corbu', 12], ['23 August', 14], ['Piatra', 7], ['Ovidiu', 5]
  ];

  /* ---------- state ---------- */
  const DEF = {
    dest: '', from: '2026-06-05', to: '2026-06-12',
    adults: 2, kids: 2, ages: [7, 11], rooms: 2,
    hotel: 'Complex Mediteranean', rate: 'Cameră dublă vedere mare', ratePrice: 4046,
    payMode: 'advance', voucher: 0, promo: null, flex: 'exact'
  };
  let S = Object.assign({}, DEF);
  try { S = Object.assign(S, JSON.parse(localStorage.getItem('litro') || '{}')); } catch (e) { }
  const q = new URLSearchParams(location.search);
  ['dest', 'from', 'to', 'hotel', 'rate'].forEach(k => { if (q.get(k)) S[k] = q.get(k); });
  /* 'rooms' is also the demo panel's room-types-on-card switch (?rooms=on|off,
     read separately below as document.body.dataset.rooms) — a non-numeric value
     here must be ignored rather than coerced into NaN. Same guard covers stray
     junk on the other three keys and still accepts a legitimate "0".
     Finite, not merely non-NaN: `+'Infinity'` is a number and would otherwise
     render as one. */
  ['adults', 'kids', 'rooms', 'ratePrice'].forEach(k => { const v = q.get(k), n = +v; if (v && Number.isFinite(n)) S[k] = n; });
  /* Intrarea „la rece" — URL fără parametrul dest, adică din Google, dintr-un
     link sau din pagina de prezentare — pornește de la tot litoralul, chiar dacă
     sesiunea ține minte ultima stațiune. Navigarea din aplicație poartă mereu
     dest în qs(), deci acolo căutarea se păstrează. */
  if (!q.has('dest')) S.dest = '';

  const save = () => localStorage.setItem('litro', JSON.stringify(S));
  const nights = () => nightsBetween(S.from, S.to);

  /* ---------- price model (deterministic, season-aware) ---------- */
  function dayFactor(d) {
    const m = d.getMonth(), day = d.getDate(), dow = d.getDay();
    let f = 1;
    if (m === 5) f = day < 15 ? 0.86 : 0.95;         // june
    else if (m === 6) f = 1.12;                       // july
    else if (m === 7) f = day < 20 ? 1.18 : 1.05;     // august
    else if (m === 8) f = day < 12 ? 0.9 : 0.72;      // september
    else f = 0.7;
    if (dow === 5 || dow === 6) f *= 1.06;            // weekend
    f *= 1 + (((day * 7919) % 13) - 6) / 100;         // deterministic per-day variation
    return f;
  }
  const ppnFor = (base, dateStr) => Math.round(base * dayFactor(parse(dateStr)) / 5) * 5;
  function stayTotal(base, from, to) {
    let t = 0, d = parse(from);
    const end = parse(to);
    while (d < end) { t += ppnFor(base, iso(d)); d = addDays(d, 1); }
    return t;
  }

  /* ---------- toast ---------- */
  const toastWrap = el('div', 'toast-wrap'); document.body.appendChild(toastWrap);
  function toast(msg, kind) {
    const t = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    toastWrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 260); }, 2600);
  }

  /* ---------- modal ---------- */
  const ov = el('div', 'ov'); ov.innerHTML = '<div class="modal"></div>'; document.body.appendChild(ov);
  const modal = $('.modal', ov);
  function openModal(title, bodyHtml, cls) {
    modal.className = 'modal' + (cls ? ' ' + cls : '');
    modal.innerHTML = '<div class="modal-head"><h3></h3><span class="x">✕</span></div><div class="modal-body"></div>';
    $('h3', modal).textContent = title;
    $('.modal-body', modal).innerHTML = bodyHtml;
    ov.classList.add('open');
    $('.x', modal).onclick = closeModal;
    return modal;
  }
  function closeModal() { ov.classList.remove('open'); }
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeAllPops(); }
  });

  /* ---------- spinner + page transition ---------- */
  const spin = el('div', 'spin'); document.body.appendChild(spin);
  function goto(url, delay) {
    spin.classList.add('on');
    document.body.classList.add('searching');
    setTimeout(() => { location.href = url; }, delay == null ? 420 : delay);
  }
  /* La „înapoi” pagina se întoarce din bfcache exact cum am părăsit-o — adică cu spinnerul pornit și cu
     vălul peste tot, deci pare că se încarcă la nesfârșit. `pageshow` e singurul eveniment care se
     declanșează și la restaurare, nu doar la încărcare, deci acolo curățăm starea de tranziție. */
  window.addEventListener('pageshow', () => {
    spin.classList.remove('on');
    document.body.classList.remove('searching');
  });
  function qs() {
    return '?dest=' + encodeURIComponent(S.dest) + '&from=' + S.from + '&to=' + S.to +
      '&adults=' + S.adults + '&kids=' + S.kids + '&rooms=' + S.rooms;
  }

  /* ---------- popovers ---------- */
  let openPop = null;
  function closeAllPops() { $$('.pop.open, .menu.open').forEach(p => p.classList.remove('open')); $$('.s-field.active').forEach(f => f.classList.remove('active')); openPop = null; }
  document.addEventListener('click', e => {
    if (openPop && !openPop.contains(e.target) && !e.target.closest('[data-pop-anchor]')) closeAllPops();
  });
  /* expuse ca bara lipită de sus și stay-bar-ul de pe hotel să deschidă exact aceleași editoare */
  let searchOpenCal = null, searchOpenGuests = null, searchOpenDest = null, searchPaint = null;
  function placePop(pop, anchor, opts, host) {
    const r = anchor.getBoundingClientRect();
    host = host || anchor.closest('.search-card') || document.body;
    const hr = host.getBoundingClientRect();
    pop.style.top = (r.bottom - hr.top + 10) + 'px';
    if (opts && opts.right) pop.style.right = (hr.right - r.right) + 'px', pop.style.left = 'auto';
    else pop.style.left = Math.max(0, r.left - hr.left) + 'px', pop.style.right = 'auto';
  }

  /* ============================================================
     SEARCH WIDGET (home / listing / hotel headers)
     ============================================================ */
  function initSearch() {
    const card = $('.search-card');
    if (!card) return;
    card.style.position = 'relative';
    const fields = $$('.s-field', card);
    if (!fields.length) return;
    const [fDest, fDate, fGuest] = fields;

    /* --- render current state into the fields --- */
    function paint() {
      const setVal = (f, v) => { const n = $('.s-value', f); if (n) n.innerHTML = v; };
      if (fDest) setVal(fDest, destLabel());
      if (fDate) setVal(fDate, fmtRange(S.from, S.to));
      if (fGuest) {
        const parts = [S.adults + (EN() ? ' adult' + (S.adults === 1 ? '' : 's') : ' ' + (S.adults === 1 ? 'adult' : 'adulți'))];
        if (S.kids) parts.push(S.kids + (EN() ? ' child' + (S.kids === 1 ? '' : 'ren') : ' ' + (S.kids === 1 ? 'copil' : 'copii')));
        parts.push(S.rooms + (EN() ? (S.rooms===1?' room':' rooms') : (S.rooms===1?' cameră':' camere')));
        setVal(fGuest, parts.join(', '));
      }
      $$('[data-bind="dates"]').forEach(n => n.textContent = fmtRange(S.from, S.to));
      $$('[data-bind="nights"]').forEach(n => n.textContent = nights());
      $$('[data-bind="guests"]').forEach(n => {
        n.textContent = guestsTxt();
      });
      $$('[data-bind="rooms"]').forEach(n => n.textContent = S.rooms + (EN() ? (S.rooms===1?' room':' rooms') : (S.rooms===1?' cameră':' camere')));
      $$('[data-bind="dest"]').forEach(n => n.textContent = destLabel());
    }

    /* --- destination popover --- */
    const popD = el('div', 'pop pop-dest');
    popD.innerHTML = '<input class="search-in" placeholder="' +
      lang('Caută stațiune sau hotel…', 'Search a resort or hotel…') + '"><div class="list"></div>';
    card.appendChild(popD);
    function renderDest(filter) {
      const list = $('.list', popD);
      const f = (filter || '').toLowerCase();
      const rows = RESORTS.filter(r => !f || r[0].toLowerCase().includes(f));
      const allRow = '<div class="dest-item all' + (S.dest ? '' : ' sel') + '" data-d="">' +
        '<svg width="16" height="16" class="ic"><use href="#i-search"/></svg>' + (EN() ? 'All resorts' : 'Tot litoralul') +
        '<span class="c">' + money(ALL_TOTAL) + (EN() ? ' stays' : ' cazări') + '</span></div>';
      list.innerHTML = allRow + '<div class="grp">' + (EN() ? 'Or pick one resort' : 'Sau alege o stațiune') + '</div>' + rows.map(r =>
        '<div class="dest-item' + (r[0] === S.dest ? ' sel' : '') + '" data-d="' + r[0] + '">' +
        '<svg width="16" height="16" class="ic"><use href="#i-pin"/></svg>' + r[0] +
        '<span class="c">' + r[1] + lang(' cazări', ' stays') + '</span></div>').join('') +
        (rows.length ? '' : '<div class="dest-item">' + lang('Nicio stațiune găsită', 'No resort found') + '</div>');
      $$('.dest-item[data-d]', list).forEach(it => it.onclick = () => {
        S.dest = it.dataset.d; save(); paint(); closeAllPops();
        if (document.body.dataset.page === 'listing') { rerunSearch(); }
      });
    }
    function openDest(anchor, host) {
      const wasOpen = popD.classList.contains('open');
      closeAllPops(); if (wasOpen) return;
      host = host || card;
      if (popD.parentElement !== host) host.appendChild(popD);
      renderDest(''); placePop(popD, anchor, null, host); popD.classList.add('open'); anchor.classList.add('active');
      openPop = popD; const inp = $('.search-in', popD); inp.value = ''; inp.focus();
      inp.oninput = () => renderDest(inp.value);
    }
    searchOpenDest = openDest;
    if (fDest) { fDest.setAttribute('data-pop-anchor', ''); fDest.onclick = () => openDest(fDest, card); }

    /* --- calendar popover --- */
    const popC = el('div', 'pop pop-cal'); card.appendChild(popC);
    let calAnchorMonth = new Date(2026, 5, 1);
    let pick = { from: S.from, to: S.to, half: false, flex: S.flex && S.flex !== 'exact' ? S.flex : 'Date exacte' };
    const CAL_FLEX = ['Date exacte', '± 1 zi', '± 3 zile', 'Un weekend', 'O săptămână'];
    function renderCal() {
      const mk = (base) => {
        const y = base.getFullYear(), m = base.getMonth();
        const first = new Date(y, m, 1);
        const startIdx = (first.getDay() + 6) % 7;
        const days = new Date(y, m + 1, 0).getDate();
        let cells = '';
        for (let i = 0; i < startIdx; i++) cells += '<div class="cal-d out"></div>';
        for (let d = 1; d <= days; d++) {
          const ds = iso(new Date(y, m, d));
          const past = parse(ds) < TODAY;
          const ppn = ppnFor(560, ds);
          let cl = 'cal-d';
          if (past) cl += ' past';
          if (ppn <= 500) cl += ' cheap';
          if (pick.from && ds === pick.from) cl += ' start';
          if (pick.to && ds === pick.to) cl += ' end';
          if (pick.from && pick.to && ds > pick.from && ds < pick.to) cl += ' in';
          cells += '<div class="' + cl + '" data-d="' + ds + '">' + d +
            (past ? '' : '<span class="p">' + ppn + '</span>') + '</div>';
        }
        return '<div class="cal-m"><div class="mname">' + MONL[m] + ' ' + y + '</div>' +
          '<div class="cal-grid">' + DOW.map(x => '<div class="dow">' + x + '</div>').join('') + cells + '</div></div>';
      };
      const next = new Date(calAnchorMonth.getFullYear(), calAnchorMonth.getMonth() + 1, 1);
      const n = pick.from && pick.to ? nightsBetween(pick.from, pick.to) : 0;
      const flexInCal = document.body.hasAttribute('data-flex-in-cal');
      const flexHtml = flexInCal
        ? '<div class="cal-flex"><span class="lbl">Date flexibile:</span>' +
          CAL_FLEX.map(f => '<span class="fx-chip' + ((pick.flex || 'Date exacte') === f ? ' on' : '') +
            '" data-flex="' + f + '">' + f + '</span>').join('') + '</div>'
        : '';
      popC.innerHTML =
        '<div class="cal-head"><div class="t">Alege datele sejurului</div>' +
        '<div class="cal-nav"><span data-nav="-1">‹</span><span data-nav="1">›</span></div></div>' +
        flexHtml +
        '<div class="cal-months">' + mk(calAnchorMonth) + mk(next) + '</div>' +
        '<div class="cal-foot"><div class="info">' +
        (n ? '<b>' + fmtRange(pick.from, pick.to) + '</b> · ' + n + (n === 1 ? ' noapte' : ' nopți') +
          ' · preț mediu <b>' + ppnFor(560, pick.from) + ' Lei</b>/noapte'
          : 'Alege data de sosire') +
        '</div><button class="btn btn-primary" style="padding:10px 22px;font-size:14.5px" data-cal-ok>Aplică datele</button></div>';
      $$('[data-nav]', popC).forEach(b => b.onclick = () => {
        calAnchorMonth = new Date(calAnchorMonth.getFullYear(), calAnchorMonth.getMonth() + (+b.dataset.nav), 1);
        renderCal();
      });
      $$('.cal-flex .fx-chip', popC).forEach(chip => chip.onclick = () => {
        const label = chip.dataset.flex;
        pick.flex = label; S.flex = label; save();
        if (/weekend/i.test(label)) {
          let d = parse(pick.from || S.from); while (d.getDay() !== 5) d = addDays(d, 1);
          pick.from = iso(d); pick.to = iso(addDays(d, 2)); pick.half = false;
          calAnchorMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        } else if (/săptămână/i.test(label)) {
          pick.from = '2026-06-05'; pick.to = '2026-06-12'; pick.half = false;
          calAnchorMonth = new Date(2026, 5, 1);
        }
        renderCal();
      });
      $$('.cal-d[data-d]:not(.past)', popC).forEach(c => c.onclick = () => {
        const ds = c.dataset.d;
        if (!pick.half) { pick.from = ds; pick.to = null; pick.half = true; }
        else {
          if (ds <= pick.from) { pick.from = ds; pick.to = null; return renderCal(); }
          pick.to = ds; pick.half = false;
        }
        renderCal();
      });
      const ok = $('[data-cal-ok]', popC);
      if (ok) ok.onclick = () => {
        if (!pick.to) return toast('Alege și data de plecare', 'err');
        S.from = pick.from; S.to = pick.to; save(); paint(); closeAllPops();
        repriceEverything();
        toast('Datele actualizate: ' + fmtRange(S.from, S.to) + ' · ' + nights() + ' nopți', 'ok');
      };
    }
    function openCal(anchor, host) {
      const wasOpen = popC.classList.contains('open');
      closeAllPops(); if (wasOpen) return;
      pick = { from: S.from, to: S.to, half: false, flex: S.flex && S.flex !== 'exact' ? S.flex : 'Date exacte' };
      calAnchorMonth = new Date(parse(S.from).getFullYear(), parse(S.from).getMonth(), 1);
      host = host || card;
      if (popC.parentElement !== host) host.appendChild(popC);
      renderCal(); placePop(popC, anchor, null, host); popC.classList.add('open'); anchor.classList.add('active');
      openPop = popC;
    }
    searchOpenCal = openCal;
    if (fDate) { fDate.setAttribute('data-pop-anchor', ''); fDate.onclick = () => openCal(fDate, card); }

    /* --- guests popover --- */
    const popG = el('div', 'pop pop-guests'); card.appendChild(popG);
    function renderGuests() {
      const row = (label, sub, key, min, max) =>
        '<div class="g-row"><div><div class="l">' + label + '</div><div class="s">' + sub + '</div></div>' +
        '<div class="stepper"><span class="b' + (S[key] <= min ? ' off' : '') + '" data-step="' + key + '" data-dir="-1">−</span>' +
        '<span class="v">' + S[key] + '</span>' +
        '<span class="b' + (S[key] >= max ? ' off' : '') + '" data-step="' + key + '" data-dir="1">+</span></div></div>';
      popG.innerHTML = row(EN() ? 'Adults' : 'Adulți', EN() ? 'from 18 years' : 'de la 18 ani', 'adults', 1, 10) +
        row(EN() ? 'Children' : 'Copii', EN() ? '0–17 years' : '0–17 ani', 'kids', 0, 4) +
        (S.kids ? '<div class="ages">' + Array.from({ length: S.kids }).map((_, i) =>
          '<div class="age">' + (EN() ? 'Child ' : 'Copil ') + (i + 1) + ': <select data-age="' + i + '">' +
          Array.from({ length: 18 }).map((__, a) => '<option' + ((S.ages[i] || 7) === a ? ' selected' : '') + '>' + a + '</option>').join('') +
          '</select> ' + (EN() ? 'yrs' : 'ani') + '</div>').join('') + '</div>' : '') +
        row(EN() ? 'Rooms' : 'Camere', EN() ? 'assigned at reception' : 'repartizare la recepție', 'rooms', 1, 5) +
        '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-primary" style="padding:10px 20px;font-size:14px" data-g-ok>' + (EN() ? 'Done' : 'Gata') + '</button></div>';
      $$('[data-step]', popG).forEach(b => b.onclick = () => {
        if (b.classList.contains('off')) return;
        const k = b.dataset.step, dir = +b.dataset.dir;
        S[k] = Math.max(0, S[k] + dir);
        if (k === 'kids') { S.ages = Array.from({ length: S.kids }).map((_, i) => S.ages[i] != null ? S.ages[i] : 7); }
        save(); renderGuests(); paint();
      });
      $$('[data-age]', popG).forEach(sel => sel.onchange = () => { S.ages[+sel.dataset.age] = +sel.value; save(); });
      $('[data-g-ok]', popG).onclick = () => { closeAllPops(); repriceEverything(); };
    }
    function openGuests(anchor, host) {
      const wasOpen = popG.classList.contains('open');
      closeAllPops(); if (wasOpen) return;
      host = host || card;
      if (popG.parentElement !== host) host.appendChild(popG);
      renderGuests(); placePop(popG, anchor, { right: true }, host); popG.classList.add('open'); anchor.classList.add('active');
      openPop = popG;
    }
    searchOpenGuests = openGuests;
    if (fGuest) { fGuest.setAttribute('data-pop-anchor', ''); fGuest.onclick = () => openGuests(fGuest, card); }

    /* --- clear destination --- */
    const clr = $('.s-clear', card);
    if (clr) clr.onclick = e => { e.stopPropagation(); S.dest = ''; save(); paint(); toast('Alege o stațiune'); };

    /* --- submit --- */
    const btn = $('.btn-primary', card);
    if (btn) btn.onclick = () => {
      save();
      if (document.body.dataset.page === 'listing') rerunSearch();
      else goto(listingHref() + qs());
    };

    /* --- flexible date chips --- */
    $$('.fx-chip').forEach(chip => chip.onclick = () => {
      $$('.fx-chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      S.flex = chip.textContent.trim(); save();
      const label = chip.textContent.trim();
      if (/weekend/i.test(label)) {
        let d = parse(S.from); while (d.getDay() !== 5) d = addDays(d, 1);
        S.from = iso(d); S.to = iso(addDays(d, 2));
      } else if (/săptămână/i.test(label)) {
        S.from = '2026-06-05'; S.to = '2026-06-12';
      } else if (/± ?3/.test(label)) { toast('Căutăm și ±3 zile în jurul datelor tale', 'ok'); }
      else if (/± ?1/.test(label)) { toast('Căutăm și ±1 zi în jurul datelor tale', 'ok'); }
      save(); paint(); repriceEverything();
    });

    /* --- bara de căutare lipită sus -------------------------------------
       Când caseta mare iese din ecran, aceleași câmpuri se strâng într-o
       pastilă fixată sus. Nu e o copie moartă: fiecare câmp deschide exact
       același popover (mutat în pastilă prin parametrul „host"), iar butonul
       reia handlerul de submit al paginii, ca să nu existe două comportamente.
       Fiecare tip de pagină are comutatorul lui în panoul de prototip.       */
    function initSticky() {
      const kind = PAGEKIND();
      if (!STICKY_KEY[kind]) return;
      const ic = (id, s) => '<svg width="' + s + '" height="' + s + '"><use href="#' + id + '"/></svg>';
      const fld = (k, id, lbl, val) => '<div class="ss-f" data-f="' + k + '">' + ic(id, 19) +
        '<span style="min-width:0"><span class="lbl">' + lbl + '</span><span class="val">' + val + '</span></span></div>';
      const bar = el('div', 'ssearch');
      bar.innerHTML = '<div class="container in">' +
        '<a class="ss-logo" href="' + en('home-c.html') + '">' +
        '<svg class="mark" viewBox="0 0 42 42"><circle cx="19" cy="23" r="13" fill="none" stroke="#fff" stroke-width="7"/><circle cx="33" cy="8.5" r="5.5" fill="#EB802D"/></svg>' +
        '<span><span class="l1">litoralul</span><span class="l2">romanesc<b>.ro</b></span></span></a>' +
        '<div class="ss-mid"><div class="ss-pill">' +
        fld('dest', 'i-pin', lang('Unde', 'Where'), '<span data-bind="dest"></span>') +
        fld('date', 'i-cal', lang('Când', 'When'), '<span data-bind="dates"></span>') +
        fld('guests', 'i-users', lang('Oaspeți', 'Guests'), '<span data-bind="guests"></span> · <span data-bind="rooms"></span>') +
        '<span class="ss-go">' + lang('Caută', 'Search') + ' ' + ic('i-search', 18) + '</span>' +
        '</div></div>' +
        /* aceleași elemente ca în antetul paginii — telefonul call-centerului, contul și meniul —
           ca bara lipită să fie chiar antetul strâns, nu un al doilea rând de navigație */
        '<div class="ss-right">' +
        '<a class="ss-phone" href="tel:0241999">' + ic('i-phone', 19) +
        '<span><span class="n">0241 999</span><span class="h">● ' + lang('Zilnic 10:00 – 18:00', 'Daily 10:00 – 18:00') + '</span></span></a>' +
        '<span class="ss-act ss-user" role="button" tabindex="0"><span class="avatar">A</span>' +
        '<span class="lbl">' + lang('Autentifică-te', 'Sign in') + '</span></span>' +
        '<span class="ss-act ss-burger" role="button" tabindex="0" aria-label="' + lang('Meniu', 'Menu') + '">' +
        ic('i-menu', 21) + '<span class="lbl">' + lang('Meniu', 'Menu') + '</span></span>' +
        '</div></div>';
      document.body.appendChild(bar);
      const pill = $('.ss-pill', bar);
      const ssUser = $('.ss-user', bar), ssBurger = $('.ss-burger', bar);
      ssUser.setAttribute('data-pop-anchor', '');
      ssBurger.setAttribute('data-pop-anchor', '');
      ssUser.onclick = e => { e.stopPropagation(); if (openUserMenu) openUserMenu(ssUser); else loginModal(false); };
      ssBurger.onclick = e => { e.stopPropagation(); if (openNavPanel) openNavPanel(ssBurger); };
      /* eticheta contului urmează starea musafir/membru din panoul de prototip */
      const paintUser = () => {
        const inn = document.body.dataset.auth === 'in';
        $('.lbl', ssUser).textContent = inn ? 'Ana' : lang('Autentifică-te', 'Sign in');
        $('.avatar', ssUser).style.display = inn ? '' : 'none';
      };
      ssUserPaint = paintUser;
      paintUser();
      $$('.ss-f', bar).forEach(f => {
        f.setAttribute('data-pop-anchor', '');
        f.onclick = () => {
          const k = f.dataset.f;
          if (k === 'dest') openDest(f, pill);
          else if (k === 'date') openCal(f, pill);
          else openGuests(f, pill);
        };
      });
      $('.ss-go', bar).onclick = () => {
        closeAllPops();
        if (btn) btn.onclick(); else goto(listingHref() + qs());
      };

      let queued = false;
      const sync = () => {
        queued = false;
        let want = document.body.dataset[STICKY_KEY[kind]] !== 'off' && !document.body.dataset.export;
        /* pe pagina hotelului bara de căutare există doar pentru vizitatorul nou
           (cine vine din listingul nostru a căutat deja) — bara lipită respectă aceeași regulă */
        if (kind === 'hotel' && document.body.dataset.session !== 'new') want = false;
        const r = card.getBoundingClientRect();
        const anchorVisible = card.offsetParent !== null && r.bottom > 6;
        const on = want && !anchorVisible;
        bar.classList.toggle('on', on);
        if (!on && openPop && bar.contains(openPop)) closeAllPops();
      };
      stickySync = sync;
      const queue = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
      window.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue);
      sync();
    }
    initSticky();

    searchPaint = paint;
    paint();
  }

  /* ============================================================
     PRICE STRIP (listing + hotel) — clicking a cell moves the stay
     ============================================================ */
  function initFlexiStrip() {
    const strip = $('.flexi-strip');
    if (!strip) return;
    const base = +(strip.dataset.base || 560);
    /* varianta B de listing: banner slim cu „de la {preț}" + nr. de hoteluri disponibile pe fiecare interval */
    function renderB() {
      const low = +(strip.dataset.low || 311);
      const cells = $$('.fx-cell', strip);
      const n = nights();
      let cheap = null, cheapVal = Infinity;
      cells.forEach((c, i) => {
        const from = addDays(parse(S.from), -3 + i);
        const to = addDays(from, n);
        c.dataset.from = iso(from); c.dataset.to = iso(to);
        const total = stayTotal(low, iso(from), iso(to));
        c.classList.toggle('sel', iso(from) === S.from);
        c.classList.remove('cheap');
        const d = $('.d', c), p = $('.p', c), s = $('.s', c);
        if (d) d.textContent = from.getDate() + ' – ' + to.getDate() + ' ' + MON[to.getMonth()];
        if (p) p.innerHTML = (EN()?'from <b>':'de la <b>') + money(total) + '</b> Lei';
        if (s) s.textContent = (c.dataset.hotels || '—') + (EN()?' hotels':' hoteluri');
        if (total < cheapVal) { cheapVal = total; cheap = c; }
      });
      if (cheap) cheap.classList.add('cheap');
    }
    function render() {
      if (document.body.dataset.listing === 'b' || document.body.dataset.listing === 'c') return renderB();
      const cells = $$('.fx-cell', strip);
      const n = nights();
      const startOffset = -4;
      cells.forEach((c, i) => {
        const from = addDays(parse(S.from), startOffset + i);
        const to = addDays(from, n);
        const total = stayTotal(base, iso(from), iso(to));
        const isSel = iso(from) === S.from;
        const soldOut = c.dataset.soldout === '1';
        c.classList.toggle('sel', isSel);
        c.classList.remove('cheap');
        c.dataset.from = iso(from); c.dataset.to = iso(to);
        const d = $('.d', c), p = $('.p', c), s = $('.s', c);
        if (d) d.textContent = from.getDate() + ' – ' + to.getDate() + ' ' + MON[to.getMonth()];
        if (soldOut) { c.classList.add('soldout'); if (p) p.textContent = 'Ocupat'; if (s) s.innerHTML = '&nbsp;'; return; }
        c.classList.remove('soldout');
        if (p) p.textContent = money(total);
        if (s) {
          if (isSel) s.textContent = 'datele tale';
          else {
            const cur = stayTotal(base, S.from, S.to);
            const diff = Math.round((total - cur) / cur * 100);
            if (diff <= -5) { c.classList.add('cheap'); s.textContent = diff + '%'; }
            else s.innerHTML = '&nbsp;';
          }
        }
      });
      const cheapest = $$('.fx-cell:not(.soldout)', strip)
        .reduce((a, b) => (+String($('.p', b).textContent).replace(/\s/g, '') < +String($('.p', a).textContent).replace(/\s/g, '') ? b : a));
      if (cheapest && !cheapest.classList.contains('sel')) { const s = $('.s', cheapest); if (s) s.textContent = 'cel mai ieftin'; cheapest.classList.add('cheap'); }
    }
    $$('.fx-cell', strip).forEach(c => c.onclick = () => {
      if (c.classList.contains('soldout')) return toast('Perioada este ocupată la acest hotel', 'err');
      S.from = c.dataset.from; S.to = c.dataset.to; save();
      repriceEverything();
      toast('Datele schimbate: ' + fmtRange(S.from, S.to), 'ok');
    });
    strip._render = render;
    render();
  }

  /* ============================================================
     GLOBAL REPRICE — everything that depends on dates/guests
     ============================================================ */
  function repriceEverything() {
    const n = nights();
    $$('[data-bind="dates"]').forEach(x => x.textContent = fmtRange(S.from, S.to));
    $$('[data-bind="nights"]').forEach(x => x.textContent = n);
    $$('[data-bind="guests"]').forEach(x => x.textContent = guestsTxt());
    $$('[data-bind="rooms"]').forEach(x => x.textContent = S.rooms + (EN() ? (S.rooms===1?' room':' rooms') : (S.rooms===1?' cameră':' camere')));
    $$('[data-bind="stayline"]').forEach(x => x.textContent = S.adults + ' adulți, ' + n + ' nopți cu mic dejun');

    // listing cards
    $$('.lcard[data-ppn]').forEach(card => {
      const base = +card.dataset.ppn;
      const total = stayTotal(base, S.from, S.to);
      const disc = +(card.dataset.disc || 0);
      const gross = disc ? Math.round(total / (1 - disc / 100)) : 0;
      const p = $('.price', card);
      if (p) p.innerHTML = money(total) + ' <span class="cur">Lei</span>';
      /* fără reducere nu există preț tăiat — altfel cardul arăta „0 Lei" barat
         (se vedea pe home-b, unde un card are data-disc="0" dar și .old-price) */
      const op = $('.old-price', card);
      if (op) { op.textContent = money(gross) + ' Lei'; op.style.display = gross > total ? '' : 'none'; }
      const note = $('.price-note', card);
      if (note) {
        const mealRo = card.dataset.meal || 'mic dejun';
        const mealEn = { 'mic dejun': 'breakfast', 'demipensiune': 'half board', 'all inclusive': 'all-inclusive', 'fără masă': 'no board', 'pensiune completă': 'full board' }[mealRo] || mealRo;
        note.innerHTML = EN()
          ? S.adults + ' adults, ' + n + ' nights with ' + mealEn + '<br>VAT included · resort tax at the hotel'
          : S.adults + ' adulți, ' + n + ' nopți cu ' + mealRo + '<br>TVA inclus · taxa de stațiune la hotel';
      }
      const cr = $('.credits', card);
      if (cr) cr.textContent = (EN()?'Earn ':'Primești ') + Math.round(total * 0.02) + (EN()?' FRIENDS credits':' credite FRIENDS');
      const sv = $('.save', card);
      if (sv) { if (gross > total) { sv.style.display = ''; sv.textContent = 'economisești ' + money(gross - total) + ' Lei'; } else sv.style.display = 'none'; }
      card.dataset.total = total;
    });

    // hotel rate rows
    $$('tr[data-ppn]').forEach(tr => {
      const base = +tr.dataset.ppn;
      const total = stayTotal(base, S.from, S.to);
      const p = $('.price', tr);
      if (p) p.innerHTML = money(total) + ' <span class="cur">Lei</span>';
      const op = $('.old-pill', tr);
      if (op) op.textContent = money(Math.round(total / 0.85)) + ' Lei';
      tr.dataset.total = total;
    });

    // hotel booking card
    const bk = $('.book-card');
    if (bk) {
      const sel = $('tr.sel[data-total]') || $('tr[data-ppn]');
      if (sel) {
        S.ratePrice = +sel.dataset.total;
        const p = $('.bk-price .price', bk);
        if (p) p.innerHTML = money(S.ratePrice) + ' <span class="cur">Lei</span>';
        const op = $('.bk-price .old-price', bk);
        if (op) op.textContent = money(Math.round(S.ratePrice / 0.85)) + ' Lei';
        const cr = $('.credits', bk);
        if (cr) cr.textContent = (EN()?'+ earn ':'+ câștigi ') + Math.round(S.ratePrice * 0.02) + (EN()?' FRIENDS credits (1 credit = 1 Leu)':' credite FRIENDS (1 credit = 1 Leu)');
        const tax = $('.athotel .pl .v', bk);
        if (tax) tax.textContent = '≈ ' + Math.round(S.ratePrice / 1.19 * 0.01) + ' Lei';
        save();
      }
    }
    const strip = $('.flexi-strip');
    if (strip && strip._render) strip._render();
    if (document.body.dataset.page === 'checkout') paintCheckout();
  }

  /* ============================================================
     HEADER — user menu, burger, nav
     ============================================================ */
  /* expuse ca bara lipită de sus să deschidă exact meniurile antetului, nu copii ale lor */
  let openUserMenu = null, openNavPanel = null;
  function initHeader() {
    const user = $('.h-user');
    if (user) {
      const m = el('div', 'menu');
      m.innerHTML = '<div class="it">Rezervările mele</div><div class="it">Credite FRIENDS: <b style="margin-left:auto">128</b></div>' +
        '<div class="it">Datele mele</div><div class="sep"></div><div class="it">Ieși din cont</div>';
      document.body.appendChild(m);
      user.setAttribute('data-pop-anchor', '');
      /* ancora e parametru: același meniu se deschide și de sub butonul din bara lipită */
      openUserMenu = anchor => {
        if (document.body.dataset.auth !== 'in') { closeAllPops(); return loginModal(false); }
        const was = m.classList.contains('open'); closeAllPops(); if (was) return;
        const r = anchor.getBoundingClientRect();
        m.style.top = (r.bottom + window.scrollY + 8) + 'px';
        m.style.left = (r.right - 240) + 'px';
        m.classList.add('open'); openPop = m;
      };
      user.onclick = e => { e.stopPropagation(); openUserMenu(user); };
      $$('.it', m).forEach(i => i.onclick = () => { closeAllPops(); toast('În prototip: ' + i.textContent.trim()); });
    }
    const burger = $('.h-burger');
    if (burger) {
      // meniul din burger preia linkurile din bara de navigare (ascunsă pe homepage), deci urmează limba paginii
      const navLinks = $$('.mainnav a').map(a => [a.textContent.trim(), a.getAttribute('href')]).filter(x => x[0]);
      const fallback = EN()
        ? [['Romanian Seaside', 'home-c-en.html'], ['Danube Delta', null], ['Seaside deals', null], ['Resorts', null], ['All-inclusive hotels', null], ['Last minute', null], ['Seaside for Everyone', null], ['FRIENDS programme', null], ['Contact', null]]
        : [['Litoral România', 'home-c.html'], ['Delta Dunării', null], ['Oferte litoral', null], ['Stațiuni', null], ['Hoteluri all inclusive', null], ['Last minute', null], ['Litoralul Pentru Toți', null], ['Program FRIENDS', null], ['Contact', null]];
      const items = navLinks.length ? navLinks : fallback;
      /* Panou ancorat sub buton, nu modal: meniul principal e navigație, nu o
         întrerupere — modalul de 900 px lăsa un câmp de alb în jurul a zece linkuri. */
      const panel = el('div', 'menu navpanel');
      panel.innerHTML = '<div class="np-grid">' +
        items.map(([t, href]) => '<a href="' + (href && href !== '#' ? href : '#') + '">' + t + '</a>').join('') +
        '</div><div class="sep"></div>' +
        '<div class="np-foot"><span><b>0241 999</b> · 0241 837 777<br>' +
        '<span class="hrs">● ' + (EN() ? 'Daily 10:00 – 18:00' : 'Zilnic 10:00 – 18:00') + '</span></span>' +
        '<a class="btn btn-outline-navy" href="tel:0241999">' + (EN() ? 'Call us' : 'Sună-ne') + '</a></div>';
      document.body.appendChild(panel);
      $$('.np-grid a', panel).forEach(a => {
        if (a.getAttribute('href') === '#') a.onclick = e => {
          e.preventDefault(); closeAllPops();
          toast((EN() ? 'In the prototype: ' : 'În prototip: ') + a.textContent.trim());
        };
      });
      burger.setAttribute('data-pop-anchor', '');
      openNavPanel = anchor => {
        const was = panel.classList.contains('open'); closeAllPops(); if (was) return;
        const r = anchor.getBoundingClientRect();
        panel.style.top = (r.bottom + window.scrollY + 10) + 'px';
        panel.style.left = 'auto';
        panel.style.right = Math.max(12, document.documentElement.clientWidth - r.right) + 'px';
        panel.classList.add('open'); openPop = panel;
      };
      burger.onclick = e => { e.stopPropagation(); openNavPanel(burger); };
    }

    $$('.mainnav a').forEach(a => {
      if (a.getAttribute('href') === '#') a.onclick = e => { e.preventDefault(); toast('În prototip: ' + a.textContent.trim()); };
    });
  }

  /* Panou plutitor de prototip (stil ca „inventar demo"): comutatorul de limbă RO/EN și
     densitatea celulelor sunt controale de demo, nu UI de produs — le scoatem din pagină. */
  function applyAuth(mode) {
    document.body.dataset.auth = mode;
    try { localStorage.setItem('litroAuth', mode); } catch (e) { }
    const hu = $('.h-user');
    if (hu) {
      const av = $('.avatar', hu);
      const nameNode = Array.from(hu.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
      if (nameNode) nameNode.textContent = mode === 'in' ? ' Ana ' : (EN() ? ' Sign in ' : ' Autentifică-te ');
      if (av) av.style.display = mode === 'in' ? '' : 'none';
      hu.classList.toggle('guest', mode !== 'in');
    }
    if (ssUserPaint) ssUserPaint();
  }

  /* Cine ajunge pe hotel direct din Google n-a căutat încă nimic — are nevoie
     de bara de căutare. Cine vine din listing a căutat deja; bara ar fi zgomot
     și l-ar scoate din flux. */
  function applySession() {
    const wrap = $('.search-wrap');
    if (!wrap || document.body.dataset.page !== 'hotel') return;
    wrap.style.display = document.body.dataset.session === 'new' ? '' : 'none';
    if (stickySync) stickySync();
  }

  /* ============================================================
     CARD FIXAT PE CARUSELUL DE CAMPANII (mecanism de „pin")
     Primul loc din carusel poate fi scos din rotație: campania cea mai
     importantă nu mai depinde de norocul autoplay-ului. Două moduri —
     „banner" (bandă lată deasupra caruselului, nu se derulează deloc) și
     „lat" (tot primul card, dar dublu, derulabil cu restul).
     Creația e compusă din text real (nu un JPG), ca să iasă editabilă în
     Figma și să existe în ambele limbi.
     ============================================================ */
  /* Creația e bannerul de campanie de pe producție (assets/promo-super-oferte*.webp):
     varianta lată pentru bandă, cea de telefon — mai strânsă — pentru cardul din linie,
     unde o bandă de 4,4:1 s-ar tăia până la ilizibil. */
  function pinCard(mode) {
    const a = el('a', 'hc-pin');
    a.href = listingHref() + qs();
    a.innerHTML =
      '<img class="pin-bg" src="assets/promo-super-oferte' + (mode === 'banner' ? '-desktop' : '') + '.webp" ' +
      'alt="' + lang('Superofertele verii — până la 40% reducere', 'Summer super deals — up to 40% off') + '">' +
      '<span class="pin-badge"><svg width="12" height="12"><use href="#i-pin"/></svg>' + lang('Fixat sus', 'Pinned') + '</span>' +
      '<span class="pin-cta">' + lang('Vezi cele 412 de oferte', 'See all 412 offers') + ' →</span>';
    return a;
  }
  let pinApply = null;   // setat mai jos; comutatorul din panou îl apelează
  function initPinnedTile() {
    const root = $('.hero-carousel');
    if (!root) return;
    const track = $('.hc-track', root);
    if (!track) return;
    applyPin(document.body.dataset.pin || 'inline');
    function applyPin(mode) {
      document.body.dataset.pin = mode;
      const old = $('.hc-pin', root); if (old) old.remove();
      root.classList.toggle('has-pin', mode === 'banner');
      root.classList.toggle('pin-inline', mode === 'inline');
      if (mode === 'off') return;
      const c = pinCard(mode);
      c.classList.add(mode === 'banner' ? 'pin-band' : 'pin-sm');
      /* în ambele moduri cardul stă în afara pistei derulabile — asta e „fixarea":
         restul campaniilor trec pe lângă el, el rămâne mereu primul și vizibil */
      root.insertBefore(c, track);
      /* pista are scroll-snap „mandatory": după ce se schimbă lățimea cardurilor,
         Chrome re-derulează la cardul pe care era fixat — o readucem la început */
      track.scrollLeft = 0;
    }
    pinApply = applyPin;
  }

  function initProtoTools() {
    /* Stările de demo se pot fixa și din URL — așa exportăm în Figma fiecare variantă
       (?auth=in|out, ?density=a|b|c) fără să dăm clic în panou. */
    if (q.get('auth')) document.body.dataset.auth = q.get('auth');
    if (q.get('density')) document.body.dataset.density = q.get('density');
    /* „rooms" e folosit de două ori în URL: qs() duce mai departe numărul de camere
       din căutare (rooms=2), iar panoul are comutatorul „Tipuri de cameră" (rooms=on|off).
       Fără verificarea valorii, orice link între ecrane scria data-rooms="2" — starea
       documentată se strica și în panou nu mai era aprins niciun buton. */
    if (['on', 'off'].indexOf(q.get('rooms')) >= 0) document.body.dataset.rooms = q.get('rooms');
    if (q.get('session')) document.body.dataset.session = q.get('session');
    if (!document.body.dataset.rooms) document.body.dataset.rooms = 'on';
    if (!document.body.dataset.session) document.body.dataset.session = 'site';
    if (!document.body.dataset.auth) { let a; try { a = localStorage.getItem('litroAuth'); } catch (e) { } document.body.dataset.auth = a || 'out'; }
    if (!document.body.dataset.density) document.body.dataset.density = 'a';
    setUrlState('inv', ['many', 'some', 'few', 'zero'].indexOf(q.get('inv')) >= 0 ? q.get('inv') : 'many');
    /* bara lipită: trei comutatoare independente (home / listing / hotel) + cardul fixat
       pe carusel. Se țin minte între pagini, ca să poți compara aceeași stare peste tot. */
    STICKY_URL.forEach(([p, key]) => {
      let v = q.get(p);
      if (!v) { try { v = localStorage.getItem('litro-' + key); } catch (e) { } }
      setStickyState(p, key, v === 'off' ? 'off' : 'on');
    });
    let pin = q.get('pin');
    if (!pin) { try { pin = localStorage.getItem('litro-pin'); } catch (e) { } }
    document.body.dataset.pin = ['off', 'inline', 'banner'].indexOf(pin) >= 0 ? pin : 'inline';
    /* coloana de filtre lipită, derulată separat de listing (?stf=on|off) */
    let stf = q.get('stf');
    if (!stf) { try { stf = localStorage.getItem('litro-stickyFilters'); } catch (e) { } }
    document.body.dataset.stickyFilters = stf === 'off' ? 'off' : 'on';
    setUrlState('stf', document.body.dataset.stickyFilters);
    /* rezultate pe pagină (?per=10|20|30) — citit înainte de ieșirea pentru export,
       ca o ramă de Figma să poată fi capturată cu orice lungime de pagină */
    let per = q.get('per');
    if (!per) { try { per = localStorage.getItem('litro-perPage'); } catch (e) { } }
    if (PAGE_SIZES.indexOf(+per) >= 0) PAGE_SIZE = +per;
    setUrlState('per', PAGE_SIZE);
    setUrlState('assets', document.body.dataset.assets ||
      (window.LITRO_ASSETS ? LITRO_ASSETS.get() : (q.get('assets') === 'prod' ? 'prod' : 'proto')));
    applySession();
    /* ?nopanel=1 — folosit la exportul în Figma, ca panoul de demo să nu ajungă în ramă */
    if (q.get('nopanel')) {
      document.body.dataset.export = '1';
      if (!document.body.dataset.auth) document.body.dataset.auth = 'out';
      applyAuth(document.body.dataset.auth);
      return;
    }
    const ls = $('.langswitch');
    const langLinks = ls ? $$('a', ls).map(a => ({ t: a.textContent.trim(), href: a.getAttribute('href'), on: a.classList.contains('on') })) : [];
    const hasListing = !!$('.listing-grid');
    const isHotel = document.body.dataset.page === 'hotel';
    const box = el('div', 'proto-tools');
    let html = '<div class="pt-h">' + (EN() ? 'Prototype · settings' : 'Prototip · setări') + '</div>';
    if (langLinks.length) {
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Language' : 'Limbă') + '</span><div class="pt-seg">' +
        langLinks.map(l => '<a href="' + (l.href || '#') + '" class="pt-b' + (l.on ? ' on' : '') + '">' + l.t + '</a>').join('') + '</div></div>';
    }
    /* comutator desktop ↔ mobile web: pe un ecran mare nu ai cum să ajungi altfel
       la versiunea de telefon, iar ecranele mobile sunt fișiere separate (m-*.html) */
    const M_MAP = {
      'home.html': 'm-home.html', 'home-b.html': 'm-home.html', 'home-c.html': 'm-home.html', 'home-d.html': 'm-home.html',
      'listing.html': 'm-listing.html', 'listing-b.html': 'm-listing.html', 'listing-c.html': 'm-listing.html',
      'hotel.html': 'm-hotel.html', 'checkout.html': 'm-checkout.html', 'thankyou.html': 'm-thankyou.html'
    };
    const here = (location.pathname.split('/').pop() || 'home-c.html').replace('-en.html', '.html');
    const mFile = M_MAP[here];
    if (mFile) {
      const mHref = (EN() ? mFile.replace('.html', '-en.html') : mFile) + qs();
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'View' : 'Vedere') + '</span><div class="pt-seg">' +
        '<span class="pt-b on">Desktop</span>' +
        '<a class="pt-b" href="' + mHref + '">' + (EN() ? 'Mobile' : 'Mobil') + '</a></div></div>';
    }
    /* pozele: cele din prototip sau fotografiile reale de pe litoralulromanesc.ro
       (vezi prod-assets.js — schimbă doar imaginile, nu și textele sau prețurile) */
    if (window.LITRO_ASSETS && LITRO_ASSETS.available) {
      const aModes = EN() ? [['proto', 'Prototype'], ['prod', 'Production']] : [['proto', 'Prototip'], ['prod', 'Producție']];
      const aTitle = EN() ? 'Swap every photo for the real one from litoralulromanesc.ro — same layout, the photo base we actually have'
        : 'Schimbă toate pozele cu cele reale de pe litoralulromanesc.ro — aceeași machetă, baza de poze pe care o avem';
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Photos' : 'Fotografii') + '</span><div class="pt-seg pt-assets" title="' + aTitle + '">' +
        aModes.map(([k, label]) => '<span class="pt-b' + (LITRO_ASSETS.get() === k ? ' on' : '') + '" data-a="' + k + '">' + label + '</span>').join('') + '</div></div>';
    }
    const authModes = EN() ? [['out', 'Guest'], ['in', 'Member']] : [['out', 'Musafir'], ['in', 'Membru']];
    html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Account' : 'Cont') + '</span><div class="pt-seg pt-auth">' +
      authModes.map(([k, label]) => '<span class="pt-b' + (document.body.dataset.auth === k ? ' on' : '') + '" data-auth="' + k + '">' + label + '</span>').join('') + '</div></div>';
    if (isHotel) {
      const modes = EN() ? [['new', 'New visitor'], ['site', 'From our site']] : [['new', 'Vizitator nou'], ['site', 'De pe site']];
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Session' : 'Sesiune') + '</span><div class="pt-seg pt-sess">' +
        modes.map(([k, label]) => '<span class="pt-b' + (document.body.dataset.session === k ? ' on' : '') + '" data-sess="' + k + '">' + label + '</span>').join('') + '</div></div>';
    }
    const yn = EN() ? [['on', 'Yes'], ['off', 'No']] : [['on', 'Da'], ['off', 'Nu']];
    if (hasListing) {
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Room types on card' : 'Tipuri de cameră') + '</span><div class="pt-seg pt-rooms">' +
        yn.map(([k, label]) => '<span class="pt-b' + (document.body.dataset.rooms === k ? ' on' : '') + '" data-rooms="' + k + '">' + label + '</span>').join('') + '</div></div>';
      if (!document.body.dataset.density) document.body.dataset.density = 'a';
      const modes = EN() ? [['a', 'Detailed'], ['b', 'Compact'], ['c', 'Icons']] : [['a', 'Detaliat'], ['b', 'Compact'], ['c', 'Iconițe']];
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Card view' : 'Densitate celule') + '</span><div class="pt-seg pt-den">' +
        modes.map(([k, label]) => '<span class="pt-b' + (document.body.dataset.density === k ? ' on' : '') + '" data-d="' + k + '" title="' + label + '">' + k.toUpperCase() + '</span>').join('') + '</div></div>';
      /* câte rezultate intră pe o pagină — schimbă și lista, și paginarea */
      const perTitle = EN() ? 'How many results fit on one page, before the pager'
        : 'Câte rezultate intră pe o pagină, până la paginare';
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Results per page' : 'Rezultate pe pagină') + '</span>' +
        '<div class="pt-seg pt-per" title="' + perTitle + '">' +
        PAGE_SIZES.map(v => '<span class="pt-b' + (PAGE_SIZE === v ? ' on' : '') + '" data-per="' + v + '">' + v + '</span>').join('') +
        '</div></div>';
      /* coloana de filtre: lipită și derulată separat de listing, sau curgând cu pagina */
      const stfTitle = EN() ? 'Filters stay in view and scroll on their own, separately from the results'
        : 'Filtrele rămân pe ecran și se derulează singure, separat de rezultate';
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Filter column' : 'Coloana de filtre') + '</span><div class="pt-seg pt-filt" title="' + stfTitle + '">' +
        yn.map(([k, label]) => '<span class="pt-b' + (document.body.dataset.stickyFilters === k ? ' on' : '') + '" data-v="' + k + '">' +
          (k === 'on' ? (EN() ? 'Sticky' : 'Lipită') : (EN() ? 'Flows' : 'Curge')) + '</span>').join('') + '</div></div>';
    }
    /* trei comutatoare independente pentru bara de căutare lipită — se văd pe orice
       pagină (starea se ține minte), dar e evidențiat rândul care schimbă pagina curentă */
    html += '<div class="pt-grp">' + (EN() ? 'Sticky search bar' : 'Bară de căutare lipită') + '</div>';
    [['stickyHome', 'Homepage', 'home'], ['stickyList', 'Listing', 'listing'], ['stickyHotel', 'Hotel', 'hotel']].forEach(([key, label, kind]) => {
      html += '<div class="pt-sub' + (PAGEKIND() === kind ? ' here' : '') + '"><span class="pt-lbl">' + label + '</span>' +
        '<div class="pt-seg pt-st" data-key="' + key + '">' +
        yn.map(([k, l]) => '<span class="pt-b' + (document.body.dataset[key] === k ? ' on' : '') + '" data-v="' + k + '">' + l + '</span>').join('') +
        '</div></div>';
    });
    if ($('.hero-carousel')) {
      const pins = EN()
        ? [['off', 'No', 'No pinned card'], ['inline', 'Row', 'Pinned as the first card, in the carousel row'], ['banner', 'Banner', 'Pinned as a wide band above the carousel']]
        : [['off', 'Nu', 'Fără card fixat'], ['inline', 'Linie', 'Fixat ca primul card, în linia caruselului'], ['banner', 'Banner', 'Fixat ca bandă lată deasupra caruselului']];
      html += '<div class="pt-row"><span class="pt-lbl">' + (EN() ? 'Pinned card' : 'Card fixat') + '</span><div class="pt-seg pt-pin">' +
        pins.map(([k, l, ti]) => '<span class="pt-b' + (document.body.dataset.pin === k ? ' on' : '') + '" data-pin="' + k + '" title="' + ti + '">' + l + '</span>').join('') + '</div></div>';
    }
    box.innerHTML = html;
    document.body.appendChild(box);
    $$('.pt-st', box).forEach(seg => $$('.pt-b', seg).forEach(b => b.onclick = () => {
      setStickyState(STICKY_PARAM[seg.dataset.key], seg.dataset.key, b.dataset.v);
      try { localStorage.setItem('litro-' + seg.dataset.key, b.dataset.v); } catch (e) { }
      $$('.pt-b', seg).forEach(x => x.classList.toggle('on', x === b));
      if (stickySync) stickySync();
    }));
    $$('.pt-pin .pt-b', box).forEach(b => b.onclick = () => {
      try { localStorage.setItem('litro-pin', b.dataset.pin); } catch (e) { }
      $$('.pt-pin .pt-b', box).forEach(x => x.classList.toggle('on', x === b));
      if (pinApply) pinApply(b.dataset.pin);
    });
    $$('.pt-filt .pt-b', box).forEach(b => b.onclick = () => {
      document.body.dataset.stickyFilters = b.dataset.v;
      setUrlState('stf', b.dataset.v);
      try { localStorage.setItem('litro-stickyFilters', b.dataset.v); } catch (e) { }
      $$('.pt-filt .pt-b', box).forEach(x => x.classList.toggle('on', x === b));
    });
    $$('.pt-per .pt-b', box).forEach(b => b.onclick = () => {
      PAGE_SIZE = +b.dataset.per;
      setUrlState('per', PAGE_SIZE);
      try { localStorage.setItem('litro-perPage', b.dataset.per); } catch (e) { }
      $$('.pt-per .pt-b', box).forEach(x => x.classList.toggle('on', x === b));
      if (listingRepaint) listingRepaint();
    });
    $$('.pt-den .pt-b', box).forEach(btn => btn.onclick = () => {
      document.body.dataset.density = btn.dataset.d;
      $$('.pt-den .pt-b', box).forEach(b => b.classList.toggle('on', b === btn));
    });
    $$('.pt-rooms .pt-b', box).forEach(btn => btn.onclick = () => {
      document.body.dataset.rooms = btn.dataset.rooms;
      $$('.pt-rooms .pt-b', box).forEach(b => b.classList.toggle('on', b === btn));
    });
    $$('.pt-sess .pt-b', box).forEach(btn => btn.onclick = () => {
      document.body.dataset.session = btn.dataset.sess;
      $$('.pt-sess .pt-b', box).forEach(b => b.classList.toggle('on', b === btn));
      applySession();
    });
    $$('.pt-auth .pt-b', box).forEach(btn => btn.onclick = () => {
      applyAuth(btn.dataset.auth);
      $$('.pt-auth .pt-b', box).forEach(b => b.classList.toggle('on', b === btn));
    });
    $$('.pt-assets .pt-b', box).forEach(btn => btn.onclick = () => {
      LITRO_ASSETS.set(btn.dataset.a);
      $$('.pt-assets .pt-b', box).forEach(b => b.classList.toggle('on', b === btn));
    });
    applyAuth(document.body.dataset.auth);
    /* Two read-only sheets at the foot of the panel: the changelog and the
       product use cases. They are content, not state axes, so proto-sheets.js
       only fetches them when a reviewer opens one. */
    if (window.protoSheets) protoSheets.mount(box, { en: EN(), carry: qs() });
    /* Comenzile de demo stau într-un jgheab în stânga, împreună cu caseta „inventar
       demo": o singură coloană care se derulează pe dinăuntru, deci nu mai poate fi
       tăiată de marginea de jos a ecranului, oricâte comutatoare adăugăm. (Înainte
       panoul era așezat cu getBoundingClientRect sub casetă și ieșea din ecran.)
       Se strânge la o pastilă „⚙", ca să nu acopere coloana de filtre.            */
    const rail = el('div', 'proto-rail');
    const tgl = el('span', 'pr-min');
    const rbody = el('div', 'pr-body');
    rail.append(tgl, rbody);
    const inv = $('.invdemo');
    if (inv) rbody.appendChild(inv);
    rbody.appendChild(box);
    document.body.appendChild(rail);
    let mini = false;
    try { mini = localStorage.getItem('litro-panel') === 'mini'; } catch (e) { }
    const paintRail = () => {
      rail.classList.toggle('mini', mini);
      tgl.textContent = mini ? '⚙ ' + (EN() ? 'Prototype · settings' : 'Prototip · setări') : '–';
      tgl.title = mini ? (EN() ? 'Show the prototype controls' : 'Arată comenzile de prototip')
        : (EN() ? 'Collapse' : 'Restrânge');
    };
    tgl.onclick = () => {
      mini = !mini;
      try { localStorage.setItem('litro-panel', mini ? 'mini' : 'open'); } catch (e) { }
      paintRail();
    };
    paintRail();
  }

  /* ============================================================
     LISTING
     ============================================================ */

  /* Proprietăți reale de pe litoralulromanesc.ro, cu stațiunea și distanța lor,
     folosite ca să umplem pagina până la cele PAGE_SIZE rezultate despre care
     vorbește paginarea. Primele sunt din Mamaia, ca lista să rămână credibilă și
     când cineva caută acolo; restul acoperă litoralul, adică starea implicită
     („Tot litoralul"). [nume, [stațiune RO, EN], m până la plajă, stele, notă, recenzii, preț/noapte] */
  const FILL_HOTELS = [
    ['Hotel Zenith', ['Mamaia, zona Perla', 'Mamaia, Perla area'], 120, 4, 8.8, 512, 690],
    ['Hotel Savoy', ['Mamaia, zona Cazino', 'Mamaia, Cazino area'], 60, 4, 9.0, 934, 845],
    ['Hotel Tomis', ['Mamaia, zona Rex', 'Mamaia, Rex area'], 90, 3, 8.2, 388, 402],
    ['Hotel Dunărea', ['Mamaia, zona Perla', 'Mamaia, Perla area'], 200, 3, 7.9, 267, 355],
    ['Phoenicia Blue View', ['Mamaia Nord', 'Mamaia Nord'], 250, 4, 8.5, 1420, 720],
    ['Hotel Mondial', ['Eforie Nord, faleză', 'Eforie Nord, seafront'], 80, 4, 8.7, 421, 560],
    ['Aqvatonic Resort & SPA', ['Eforie Nord, Steaua de Mare', 'Eforie Nord, Steaua de Mare'], 150, 4, 8.9, 683, 780],
    ['Vila Belvedere', ['Eforie Nord, zona Belona', 'Eforie Nord, Belona area'], 400, 4, 9.1, 158, 610],
    ['Hotel Aqua Park', ['Eforie Nord', 'Eforie Nord'], 100, 4, 8.6, 731, 705],
    ['Hotel Cupidon', ['Eforie Nord', 'Eforie Nord'], 300, 3, 7.7, 219, 298],
    ['Hotel Arta', ['Eforie Nord', 'Eforie Nord'], 180, 3, 8.1, 344, 330],
    ['Hotel Delfinul', ['Eforie Nord', 'Eforie Nord'], 120, 3, 8.0, 402, 340],
    ['Hotel Vera', ['Eforie Nord', 'Eforie Nord'], 220, 3, 8.3, 276, 365],
    ['Bacolux Koralio', ['Eforie Nord', 'Eforie Nord'], 60, 3, 8.4, 512, 470],
    ['Hotel Poseidon Resort', ['Jupiter', 'Jupiter'], 50, 4, 8.8, 604, 690],
    ['Hotel Opal', ['Jupiter', 'Jupiter'], 80, 3, 8.2, 298, 385],
    ['Hotel Olimpic', ['Jupiter', 'Jupiter'], 150, 3, 7.9, 233, 342],
    ['Hotel Turquoise', ['Venus', 'Venus'], 70, 4, 9.0, 812, 735],
    ['Mera Resort', ['Venus', 'Venus'], 90, 4, 8.9, 1180, 760],
    ['Hotel Del Mar', ['Venus', 'Venus'], 130, 3, 8.1, 289, 395],
    ['Ibis Styles Venus', ['Venus', 'Venus'], 200, 3, 8.5, 447, 430],
    ['Hotel Q', ['Neptun', 'Neptun'], 110, 4, 8.7, 356, 640],
    ['2D Resort and Spa', ['Neptun-Olimp', 'Neptun-Olimp'], 160, 4, 8.6, 528, 615],
    ['Muntenia Olimp Resort', ['Olimp', 'Olimp'], 60, 3, 8.3, 486, 420]
  ];
  const FILL_ROOMS = [
    [['Cameră dublă standard', 'Standard double room'], ['1 pat dublu · 20 m²', '1 double bed · 20 m²']],
    [['Cameră dublă vedere mare', 'Double room with sea view'], ['1 pat dublu · balcon', '1 double bed · balcony']],
    [['Cameră twin', 'Twin room'], ['2 paturi separate', '2 separate beds']],
    [['Cameră family', 'Family room'], ['2 adulți + 2 copii · 30 m²', '2 adults + 2 children · 30 m²']],
    [['Studio', 'Studio'], ['chicinetă · terasă proprie', 'kitchenette · own terrace']],
    [['Apartament 2 camere', '2-room apartment'], ['living separat · 45 m²', 'separate living room · 45 m²']]
  ];
  const FILL_QUOTES = [
    ['Curat, personal amabil, plaja la două minute.', 'Clean, friendly staff, the beach two minutes away.'],
    ['Mic dejun bun și variat, ne-am întors cu drag.', 'Good, varied breakfast — we came back happily.'],
    ['Camera exact ca în poze, fără surprize.', 'The room exactly like the photos, no surprises.'],
    ['Raport calitate-preț foarte bun pentru zonă.', 'Very good value for money for the area.'],
    ['Piscina e mare, copiii au stat în ea toată ziua.', 'The pool is big, the kids stayed in it all day.'],
    ['Parcare proprie și liniște seara.', 'Own parking, and quiet in the evening.']
  ];
  const FILL_PHOTOS = ['pool-rooftop', 'room-seaview', 'lobby', 'aerial-hotel', 'pool-sunset',
    'room-double', 'jacuzzi-view', 'spa-indoor', 'apartment-family', 'coastline'];

  function scoreWord(s) {
    return s >= 9 ? (EN() ? 'Excellent' : 'Excelent')
      : s >= 8.4 ? (EN() ? 'Very good' : 'Foarte bine')
        : s >= 7.8 ? (EN() ? 'Good' : 'Bine') : (EN() ? 'Fair' : 'Acceptabil');
  }

  /* ------------------------------------------------------------
     O pagină de listing are PAGE_SIZE rezultate, dar în fișier stau
     doar cardurile scrise de mână. Fără asta, paginarea („Afișăm
     1–30 din 1 236") minte chiar pe primul ecran. Clonăm cardurile
     existente — deci se păstrează variantele de card, iar chipurile
     rămân lipite de atributele lor (masă, confirmare, inventar
     propriu vin odată cu sursa) — și schimbăm doar ce ține de
     proprietate: nume, stațiune, notă, preț, poză, tip de cameră.
     Rulează înaintea restului lui initListing, ca fiecare card nou
     să primească galerie, filtre și expander ca toate celelalte.
     ------------------------------------------------------------ */
  function fillListingPage() {
    const have = $$('.lcard');
    if (!have.length || have.length >= MAX_PAGE) return;
    let after = have[have.length - 1];
    for (let i = 0; have.length + i < MAX_PAGE; i++) {
      const d = FILL_HOTELS[i % FILL_HOTELS.length];
      const src = have[i % have.length];
      const n = src.cloneNode(true);
      const suffix = i >= FILL_HOTELS.length ? ' ' + (Math.floor(i / FILL_HOTELS.length) + 1) : '';

      n.dataset.beach = d[2];
      n.dataset.score = d[4];
      n.dataset.ppn = d[6];
      n.dataset.rank = have.length + i + 1;

      const nm = $('.hname', n);
      if (nm && nm.firstChild) nm.firstChild.nodeValue = d[0] + suffix + ' ';
      const stars = $('.stars', n);
      if (stars) stars.textContent = '★'.repeat(d[3]);

      const meta = $('.hmeta', n);
      if (meta) {
        const txt = Array.prototype.find.call(meta.childNodes, x => x.nodeType === 3 && x.textContent.trim());
        if (txt) txt.nodeValue = ' ' + d[1][EN() ? 1 : 0] + ' · ' +
          (d[2] ? d[2] + (EN() ? ' m from the beach · ' : ' m de plajă · ') : (EN() ? 'right on the beach · ' : 'chiar pe plajă · '));
      }

      const badge = $('.rate-badge', n); if (badge) badge.textContent = d[4].toFixed(1);
      const word = $('.rate-word', n); if (word) word.textContent = scoreWord(d[4]);
      const rcnt = $('.rate-count', n); if (rcnt) rcnt.textContent = d[5] + (EN() ? ' reviews' : ' recenzii');

      const img = $('.ph img', n);
      if (img) img.setAttribute('src', 'assets/' + FILL_PHOTOS[i % FILL_PHOTOS.length] + '.jpg');

      const room = FILL_ROOMS[i % FILL_ROOMS.length];
      const rt = $('.lc-room .rt', n); if (rt) rt.textContent = room[0][EN() ? 1 : 0];
      const rd = $('.lc-room .rd', n); if (rd) rd.textContent = room[1][EN() ? 1 : 0];

      const q = $('.quote', n);
      if (q) {
        const qt = $('.t', q);
        if (qt) qt.textContent = (EN() ? '“' : '„') + FILL_QUOTES[i % FILL_QUOTES.length][EN() ? 1 : 0] + '”';
        const qh = $('.h b', q);
        if (qh) qh.textContent = (EN() ? 'Score ' : 'Nota ') + Math.round(d[4]) + '/10';
      }
      /* oferta care expiră e un semnal, nu decor: dacă e pe fiecare card nu mai spune nimic.
         La fel „Nou pe litoralulromanesc.ro" — rămâne doar pe cardul scris de mână. */
      if (i % 4) $$('.expiry', n).forEach(x => x.remove());
      $$('.pill-new', n).forEach(x => x.remove());
      const mr = $('.more-rooms .cnt', n);
      if (mr) mr.textContent = '(' + (3 + (i % 6)) + ')';

      after.after(n);
      after = n;
    }
  }

  function initListing() {
    if (document.body.dataset.page !== 'listing') return;
    fillListingPage();
    const cards = $$('.lcard');

    /* --- headline binding --- */
    const h1 = $('.listing-head h1');
    if (h1 && !h1.hasAttribute('data-fixed')) h1.textContent = S.dest
      ? (EN() ? 'Stays in ' : 'Cazare ') + S.dest
      : (EN() ? 'Stays along the whole seaside' : 'Cazare pe tot litoralul');

    /* --- densitate celule: implicit A; comutatorul e în panoul de prototip (initProtoTools) --- */
    if (!document.body.dataset.density) document.body.dataset.density = 'a';

    /* --- ordinea barei de filtre ---------------------------------------
       Sub hartă stă butonul mare „Garantat de noi" — setul contractat direct
       e prima decizie pe care vrem s-o ia utilizatorul. Apoi filtrele lui
       recente, cele populare, disponibilitatea, prețul și restul grupelor.
       Ordinea trăiește aici, ca să fie una singură pentru RO și EN.        */
    const aside = $('.listing-grid aside');
    if (aside) {
      const fboxByTitle = ts => $$('.fbox', aside).find(b => { const h = $('h3', b); return h && ts.some(t => h.textContent.trim().startsWith(t)); });
      const ORDER = [
        ['Filtrele tale recente', 'Your recent filters'],
        ['Filtre populare', 'Popular filters'],
        null,                                              // marcaj: aici intră caseta de disponibilitate
        ['Preț pe noapte', 'Price per night'],
        ['Pe baza recenziilor', 'By review score'],
        ['Masă', 'Board'],
        ['Tip de cazare', 'Property type'],
        ['Plată și anulare', 'Payment'],
        ['Reduceri', 'Discounts'],
        ['Card de vacanță', 'Holiday card'],
      ];
      const mapCard = $('.map-card', aside);
      const avail = $('.fbox.avail', aside);
      const ownCta = buildOwnCta();
      if (mapCard) mapCard.after(ownCta); else aside.prepend(ownCta);

      let prev = ownCta;
      ORDER.forEach(titles => {
        const box = titles === null ? avail : fboxByTitle(titles);
        if (!box) return;
        prev.after(box);
        prev = box;
      });
      const popular = fboxByTitle(['Filtre populare', 'Popular filters']);
      if (popular) popular.classList.add('fbox-compact');
      /* disponibilitatea rămâne cu două opțiuni: ce se poate rezerva și ce se
         confirmă instantaneu; restul rândurilor erau zgomot */
      if (avail) $$('.frow', avail).slice(2).forEach(r => r.remove());
    }

    /* butonul mare de sub hartă — comută același filtru ca pastila „Garantat de noi" */
    function buildOwnCta() {
      const box = el('div', 'own-cta');
      box.innerHTML = '<span class="ic">' + SHIELD + '</span>' +
        '<div><div class="t">' + lang('Garantat de noi', 'Guaranteed by us') + '</div>' +
        '<div class="d">' + lang('46 hoteluri contractate direct — disponibilitate reală și confirmare instantanee',
          '46 hotels contracted directly — real availability and instant confirmation') + '</div></div>' +
        '<span class="sw"></span>';
      box.onclick = () => {
        const chip = $('.pfilter[data-f="own"]');
        if (chip) chip.classList.toggle('on');
        box.classList.toggle('on', chip ? chip.classList.contains('on') : !box.classList.contains('on'));
        applyFilters(); syncChips();
      };
      return box;
    }
    function syncOwnCta() {
      const box = $('.own-cta'), chip = $('.pfilter[data-f="own"]');
      if (box) box.classList.toggle('on', !!chip && chip.classList.contains('on'));
    }

    /* --- rând de iconițe mari (rezumat pentru modul compact B): date · masă · cameră --- */
    const CAL_SVG = '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 2.8V7M16 2.8V7" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
    const FOOD_SVG = '<svg viewBox="0 0 24 24"><path d="M7 3v7M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 12v9M16.5 3c-1.8 1.5-2.5 4-2.5 6.5 0 1.5 1 2.5 2.5 2.5V21M16.5 3V12" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const BED_SVG = '<svg viewBox="0 0 24 24"><path d="M3 18.5V6M3 14h18v4.5M3 11h18v-1a3 3 0 0 0-3-3H9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6.5" cy="8.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    const mealLabel = m => {
      m = (m || '').toLowerCase();
      if (EN()) return !m || /fără/.test(m) ? 'No meal' : /mic dejun/.test(m) ? 'Breakfast' : /demipensiune/.test(m) ? 'Half board' : /pensiune completă/.test(m) ? 'Full board' : /all inclusive/.test(m) ? 'All inclusive' : m;
      return !m || /fără/.test(m) ? 'Fără masă' : m.charAt(0).toUpperCase() + m.slice(1);
    };
    cards.forEach(card => {
      const mid = $('.lc-mid', card);
      if (!mid || $('.lc-icons', card)) return;
      const rt = $('.lc-room .rt', card);
      const roomTxt = rt ? rt.textContent.trim() : (EN() ? 'Standard room' : 'Cameră standard');
      const nS = nights();
      const ic = el('div', 'lc-icons');
      ic.innerHTML =
        '<div class="lci">' + CAL_SVG + '<div class="t">' + (EN() ? 'from ' : 'din ') + fmtShort(S.from) + '</div><div class="s">' + nS + (EN() ? (nS === 1 ? ' night' : ' nights') : ' nopți') + '</div></div>' +
        '<div class="lci">' + FOOD_SVG + '<div class="t">' + mealLabel(card.dataset.meal) + '</div></div>' +
        '<div class="lci">' + BED_SVG + '<div class="t">' + roomTxt + '</div></div>';
      const anchor = $('.hmeta', mid) || $('.lc-room', mid);
      if (anchor) anchor.after(ic); else mid.appendChild(ic);
    });

    /* --- inimile de favorite: cablate în initGeneric, ca să răspundă și pe home --- */

    /* --- card photo galleries (arrows + dots on each listing card photo) --- */
    const PHOTO_POOL = ['pool-rooftop', 'room-seaview', 'lobby', 'aerial-hotel', 'pool-sunset', 'room-double', 'jacuzzi-view', 'spa-indoor', 'apartment-family', 'coastline']
      .map(n => 'assets/' + n + '.jpg');
    $$('.lcard .ph').forEach(ph => {
      const img = $('img', ph);
      if (!img || ph.dataset.gallery) return;
      ph.dataset.gallery = '1';
      const dots = $$('.dots i', ph);
      const count = dots.length || 5;
      const first = img.getAttribute('src');
      const start = Math.max(0, PHOTO_POOL.indexOf(first));
      const gallery = [first];
      for (let k = 1; k < count; k++) gallery.push(PHOTO_POOL[(start + k) % PHOTO_POOL.length]);
      gallery.forEach(src => { const im = new Image(); im.src = src; });
      let idx = 0;
      const show = i => {
        idx = (i + gallery.length) % gallery.length;
        img.src = gallery[idx];
        dots.forEach((d, di) => d.classList.toggle('on', di === idx));
      };
      const jump = to => e => { e.stopPropagation(); e.preventDefault(); show(to()); };
      const prev = el('button', 'ph-nav prev'); prev.type = 'button'; prev.setAttribute('aria-label', 'Poza anterioară'); prev.textContent = '‹';
      const next = el('button', 'ph-nav next'); next.type = 'button'; next.setAttribute('aria-label', 'Poza următoare'); next.textContent = '›';
      prev.onclick = jump(() => idx - 1); next.onclick = jump(() => idx + 1);
      dots.forEach((d, di) => { d.style.cursor = 'pointer'; d.onclick = jump(() => di); });
      ph.appendChild(prev); ph.appendChild(next);
      show(0);
    });

    /* --- open hotel --- */
    cards.forEach(c => {
      const go = () => {
        S.hotel = $('.hname', c).childNodes[0].textContent.trim();
        S.ratePrice = +(c.dataset.total || 4046);
        save();
        goto(en('hotel.html') + qs());
      };
      const cta = $('.lc-cta .btn', c);
      if (cta) cta.onclick = e => { e.stopPropagation(); go(); };
      c.addEventListener('click', e => { if (!e.target.closest('.heart, .more-rooms, a')) go(); });
    });

    /* --- fiecare card primește linkul „Vezi toate tipurile de cameră" (nu doar primul) --- */
    const ROOM_CNT = [7, 5, 6, 4, 8, 5, 6, 4];
    $$('.lcard').forEach((card, i) => {
      const mid = $('.lc-mid', card);
      if (mid && !$('.more-rooms', card)) {
        mid.appendChild(el('span', 'more-rooms',
          (EN() ? 'See all room types ' : 'Vezi toate tipurile de cameră ') + '<span class="cnt">(' + ROOM_CNT[i % ROOM_CNT.length] + ')</span> ↓'));
      }
    });

    /* --- room-type expander — listă (A/B) sau carusel de camere cu poză+descriere (C) --- */
    const ROOM_IMG = ['room-seaview', 'room-double', 'apartment-family', 'jacuzzi-view', 'pool-rooftop', 'lobby', 'spa-indoor'];
    const isCarousel = document.body.dataset.listing === 'c';
    $$('.more-rooms').forEach(m => {
      const card = m.closest('.lcard');
      const n = +(m.textContent.match(/\((\d+)\)/) || [0, 4])[1];
      const base = +(card.dataset.ppn || 80);
      const types = [
        ['Cameră dublă economy', 'fără balcon · 18 m²', -0.18],
        ['Cameră dublă standard', '1 pat dublu · 22 m²', -0.08],
        ['Cameră dublă vedere mare', '+ 2 șezlonguri incluse · 24 m²', 0],
        ['Cameră triplă', '3 adulți · 28 m²', 0.22],
        ['Cameră family', '2 adulți + 2 copii · 34 m²', 0.34],
        ['Studio 4*', 'terasă proprie · 40 m²', 0.52],
        ['Apartament 4*', '55 m², living separat', 0.78]
      ].slice(0, Math.max(3, Math.min(n, 7)));
      let box;
      if (isCarousel) {
        box = el('div', 'rcarousel');
        box.innerHTML = '<div class="rc-track">' + types.map(([nm, meta, f], i) => {
          const total = Math.round(stayTotal(base, S.from, S.to) * (1 + f));
          return '<div class="rc-room"><img src="assets/' + ROOM_IMG[i % ROOM_IMG.length] + '.jpg" alt="">' +
            '<div class="rc-body"><div class="rc-name">' + nm + '</div><div class="rc-meta">' + meta + '</div>' +
            '<div class="rc-perks"><svg width="13" height="13"><use href="#i-check-g"/></svg> Mic dejun inclus</div>' +
            '<div class="rc-foot"><div class="rc-price">' + money(total) + ' <span class="cur">Lei</span>' +
            '<span class="rc-note">' + nights() + ' nopți</span></div>' +
            '<button class="btn btn-primary rc-sel">Alege</button></div></div></div>';
        }).join('') + '</div><button class="rc-arrow prev" aria-label="Înapoi">‹</button><button class="rc-arrow next" aria-label="Înainte">›</button>';
        card.appendChild(box);   // pe toată lățimea cardului (rând nou în grid), nu doar coloana din mijloc
        const track = $('.rc-track', box);
        const step = () => { const r = $('.rc-room', track); return r ? r.getBoundingClientRect().width + 12 : 232; };
        $('.rc-arrow.prev', box).onclick = e => { e.stopPropagation(); track.scrollBy({ left: -step() }); };
        $('.rc-arrow.next', box).onclick = e => { e.stopPropagation(); track.scrollBy({ left: step() }); };
        $$('.rc-sel', box).forEach(b => b.onclick = e => {
          e.stopPropagation();
          S.hotel = $('.hname', card).childNodes[0].textContent.trim(); save();
          goto(en('hotel.html') + qs());
        });
      } else {
        box = el('div', 'extra-rooms');
        box.innerHTML = types.map(([nm, meta, f]) => {
          const total = Math.round(stayTotal(base, S.from, S.to) * (1 + f));
          return '<div class="xroom"><div><div class="n">' + nm + '</div><div class="m">' + meta + '</div></div>' +
            '<div class="p">' + money(total) + ' Lei' + (f !== 0 ? ' <span class="d">(' + (f > 0 ? '+' : '') + money(total - stayTotal(base, S.from, S.to)) + ')</span>' : '') + '</div></div>';
        }).join('');
        m.after(box);
      }
      m.onclick = e => {
        e.stopPropagation();
        box.classList.toggle('open');
        m.innerHTML = box.classList.contains('open')
          ? (EN() ? 'Hide room types ↑' : 'Ascunde tipurile de cameră ↑')
          : (EN() ? 'See all room types ' : 'Vezi toate tipurile de cameră ') + '<span class="cnt">(' + n + ')</span> ↓';
      };
    });

    /* --- filters --- */
    /* ?f=own,instant… — permite intrarea în listing cu filtre deja aplicate,
       ca linkul „vezi toate cele garantate de noi" să ducă exact acolo */
    const fParam = (q.get('f') || '').split(',').filter(Boolean);
    if (fParam.length) {
      /* linkul aduce utilizatorul cu o singură intenție — filtrele presetate
         din pagină ar dilua-o, așa că pornim de la zero */
      $$('.pfilter.on').forEach(p => p.classList.remove('on'));
      $$('.fbox:not(.avail) .cb.on').forEach(c => c.classList.remove('on'));
      fParam.forEach(k => {
        const el0 = $('[data-f="' + k + '"]');
        if (!el0) return;
        const cb = $('.cb', el0);
        if (cb) cb.classList.add('on'); else el0.classList.add('on');
      });
    }
    let demoCap = Infinity, demoCount = null;   // comutator demo de inventar (listing B)
    function applyFilters() {
      const active = {
        instant: $('[data-f="instant"]')?.classList.contains('on'),
        beach: $('[data-f="beach"]')?.classList.contains('on'),
        pool: $('[data-f="pool"]')?.classList.contains('on'),
        breakfast: $('[data-f="breakfast"]')?.classList.contains('on'),
        friends: $('[data-f="friends"]')?.classList.contains('on'),
        own: $('[data-f="own"]')?.classList.contains('on')
      };
      const anyFilter = Object.values(active).some(Boolean);
      let shown = 0;
      cards.forEach(c => {
        const f = (c.dataset.fac || '').split(',');
        let ok = true;
        if (active.instant && c.dataset.instant !== '1') ok = false;
        if (active.beach && +(c.dataset.beach || 999) > 100) ok = false;
        if (active.pool && !f.includes('pool')) ok = false;
        if (active.breakfast && !/mic dejun/i.test(c.dataset.meal || '')) ok = false;
        if (active.friends && c.dataset.friends !== '1') ok = false;
        if (active.own && c.dataset.own !== '1') ok = false;
        /* plafon: inventarul demo sau pur și simplu cât încape pe o pagină */
        if (ok && shown >= Math.min(demoCap, PAGE_SIZE)) ok = false;
        c.classList.toggle('card-hidden', !ok);
        if (ok) shown++;
      });
      const displayN = (demoCount != null && !anyFilter) ? demoCount : shown;
      const rc = $('.res-count');
      if (rc && !rc.hasAttribute('data-fixed')) rc.innerHTML = money(displayN) +
        (EN() ? (displayN === 1 ? ' available stay' : ' available stays') : (displayN === 1 ? ' cazare disponibilă' : ' cazări disponibile'));
      const rcn = $('.res-count-n');
      if (rcn) rcn.textContent = document.body.dataset.variant === 'b' ? money(shown * 206) : shown;
      // banda „FRIENDS" apare după al DOILEA card vizibil (repoziționată la fiecare filtrare)
      const band = $('.loyal-band');
      if (band) {
        const vis = cards.filter(c => !c.classList.contains('card-hidden'));
        if (vis.length > 1) { vis[1].after(band); band.style.display = ''; } else band.style.display = 'none';
      }
      // listing B: banner de date flexibile doar când sunt puține rezultate
      syncRescue(shown);
      syncPager(displayN);
      if (!shown) showEmptyState(); else hideEmptyState();
    }
    listingRepaint = applyFilters;   // comutatorul „rezultate pe pagină" din panou repictează lista

    /* ------------------------------------------------------------
       Paginare de 30 de rezultate. „Afișează mai multe" ascundea câte
       cazări mai sunt și unde te afli în listă; un pager spune și una,
       și alta, și se poate reveni la o pagină anume.
       ------------------------------------------------------------ */
    let page = 1;
    function syncPager(total) {
      const main = $('.listing-grid main');
      if (!main) return;
      const pages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
      if (page > pages) page = 1;

      let wrap = $('.pagerwrap', main);
      if (!wrap) {
        wrap = el('div', 'pagerwrap', '<div class="pg-range"></div><div class="pager"></div>');
        const more = $('.show-more', main);
        if (more) more.replaceWith(wrap); else (($('.near-band', main) || null) ? $('.near-band', main).before(wrap) : main.appendChild(wrap));
      }
      wrap.style.display = (total > PAGE_SIZE) ? '' : 'none';
      if (total <= PAGE_SIZE) return;

      const from = (page - 1) * PAGE_SIZE + 1, to = Math.min(page * PAGE_SIZE, total);
      $('.pg-range', wrap).innerHTML = EN()
        ? 'Showing <b>' + from + '–' + to + '</b> of <b>' + money(total) + '</b> stays'
        : 'Afișăm <b>' + from + '–' + to + '</b> din <b>' + money(total) + '</b> cazări';

      const nums = [];
      for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
        else if (nums[nums.length - 1] !== '…') nums.push('…');
      }
      $('.pager', wrap).innerHTML =
        (page > 1 ? '<a href="#" data-p="' + (page - 1) + '" aria-label="' + lang('Pagina anterioară', 'Previous page') + '">‹</a>' : '') +
        nums.map(n => n === '…' ? '<span class="dots">…</span>'
          : '<a href="#" data-p="' + n + '"' + (n === page ? ' class="on"' : '') + '>' + n + '</a>').join('') +
        (page < pages ? '<a href="#" data-p="' + (page + 1) + '" aria-label="' + lang('Pagina următoare', 'Next page') + '">›</a>' : '');

      $$('[data-p]', wrap).forEach(a => a.onclick = e => {
        e.preventDefault();
        page = +a.dataset.p;
        syncPager(total);
        window.scrollTo({ top: $('.listing-grid').offsetTop - 90, behavior: 'smooth' });
        toast(lang('Pagina ', 'Page ') + page + lang(' — în prototip lista rămâne aceeași', ' — the list stays the same in this prototype'));
      });
    }

    /* ------------------------------------------------------------
       Widgeturile anti-dead-end reacționează la câte rezultate rămân.
       Cu inventar bogat ar fi zgomot; când lista se subțiază, ele sunt
       singura cale de ieșire — alte date, altă stațiune sau consultantul.
       ------------------------------------------------------------ */
    function syncRescue(shown) {
      const thin = shown <= 5, dead = shown <= 2;

      /* titlul listei poartă de obicei nota generală („8.7/10 din 11 395 recenzii");
         când inventarul se subțiază, numărul real e informația care contează */
      const rc = $('.res-count');
      if (rc) {
        if (rc.dataset.orig == null) rc.dataset.orig = rc.innerHTML;
        rc.innerHTML = thin
          ? '<b>' + shown + '</b> ' + (EN() ? (shown === 1 ? 'available stay' : 'available stays') : (shown === 1 ? 'cazare disponibilă' : 'cazări disponibile')) +
            ' ' + (EN() ? 'for these dates' : 'pentru aceste date')
          : (rc.dataset.orig || '');
      }
      const fstrip = $('.flexi-strip');
      if (fstrip && (document.body.dataset.listing === 'b' || document.body.dataset.listing === 'c'))
        fstrip.style.display = thin ? '' : 'none';

      const rescue = $('main > .rescue:not(.rescue-empty)');
      if (rescue) {
        /* la zero rezultate vorbește caseta de stare goală — n-are rost să spunem de două ori acelaşi lucru */
        rescue.style.display = (thin && shown > 0) ? '' : 'none';
        rescue.classList.toggle('rescue-hi', dead);
        const tt = $('.t', rescue);
        if (tt) tt.textContent = !shown
          ? (EN() ? 'No stay matches these dates' : 'Nicio cazare pentru aceste date')
          : dead
          ? (EN() ? 'Only ' + shown + ' stays left for these dates' : 'Au mai rămas doar ' + shown + ' cazări pentru aceste date')
          : (EN() ? 'Not finding what you want for ' + fmtRange(S.from, S.to) + '?' : 'Nu găsești ce cauți pentru ' + fmtRange(S.from, S.to) + '?');
      }

      const near = $('.near-band');
      if (near) near.classList.toggle('near-hi', thin);

      /* explicație scurtă deasupra listei, ca utilizatorul să știe de ce s-a schimbat pagina */
      let note = $('.thin-note');
      if (thin && !note) {
        note = el('div', 'thin-note');
        const anchor = $('.listing-grid main .fchips') || $('.listing-grid main').firstElementChild;
        $('.listing-grid main').insertBefore(note, anchor ? anchor.nextSibling : null);
      }
      if (note) {
        note.style.display = thin ? '' : 'none';
        note.innerHTML = EN()
          ? '<b>Look at other options.</b> Shift the dates below, jump to a nearby resort, or let a consultant search our whole inventory.'
          : '<b>Vezi și alte variante.</b> Mută datele mai jos, sari la o stațiune vecină sau lasă un consultant să caute în tot inventarul nostru.';
      }
    }
    let emptyBox = null;
    function showEmptyState() {
      if (emptyBox) return;
      /* două cauze diferite, două mesaje diferite: filtre prea strânse
         versus pur și simplu nu avem nimic liber în perioada aleasă */
      const filtered = $$('.pfilter.on').length > 0 || $$('.fbox:not(.avail) .cb.on').length > 0;
      emptyBox = el('div', 'rescue rescue-empty rescue-hi');
      emptyBox.innerHTML = '<span class="ic"><svg width="22" height="22"><use href="#i-phone"/></svg></span>' +
        '<div><div class="t">' + (filtered
          ? lang('Niciun rezultat pentru filtrele alese', 'No results for the filters you picked')
          : lang('Nicio cazare liberă pentru ' + fmtRange(S.from, S.to), 'No stay available for ' + fmtRange(S.from, S.to))) + '</div>' +
        '<div class="d">' + (filtered
          ? lang('Relaxează filtrele sau lasă-ne consultanții să caute în tot inventarul nostru de pe litoral.',
                 'Relax the filters, or let our consultants search our whole seaside inventory.')
          : lang('Încearcă alte date din banda de mai jos, o stațiune vecină, sau lasă-ne numărul — consultanții văd și camerele eliberate azi.',
                 'Try other dates from the strip below, a nearby resort, or leave us your number — our consultants also see rooms released today.')) + '</div></div>' +
        '<div class="acts">' + (filtered
          ? '<button class="btn btn-outline-navy" data-clear-all>' + lang('Șterge filtrele', 'Clear filters') + '</button>'
          : '') + '<span class="phone">0241 999</span></div>';
      $('.listing-grid main').prepend(emptyBox);
      const ca = $('[data-clear-all]', emptyBox); if (ca) ca.onclick = clearAll;
    }
    function hideEmptyState() { if (emptyBox) { emptyBox.remove(); emptyBox = null; } }

    $$('.frow[data-f], .pfilter[data-f], .fbox .frow').forEach(row => {
      row.onclick = () => {
        const cb = $('.cb', row);
        if (cb) cb.classList.toggle('on'); else row.classList.toggle('on');
        if (row.dataset.f) row.classList.toggle('on', cb ? cb.classList.contains('on') : row.classList.contains('on'));
        applyFilters();
        syncChips();
      };
    });
    $$('.pfilter').forEach(p => p.onclick = () => { p.classList.toggle('on'); applyFilters(); syncChips(); });

    function syncChips() {
      const wrap = $('.fchips');
      if (!wrap) return;
      const labels = [];
      $$('.pfilter.on').forEach(p => labels.push(p.childNodes[0].textContent.trim()));
      $$('.fbox .frow').forEach(r => { if ($('.cb.on', r) && !$('.fbox.avail', r.closest('.fbox') ? undefined : undefined)) { } });
      $$('.fbox:not(.avail) .frow').forEach(r => { if ($('.cb.on', r)) labels.push(r.textContent.replace(/\(.*?\)/, '').trim()); });
      const keep = wrap.querySelector('.lbl'), clear = wrap.querySelector('.clear-all');
      wrap.innerHTML = '';
      if (keep) wrap.appendChild(keep);
      labels.slice(0, 6).forEach(l => {
        const c = el('span', 'fchip', l + ' <svg width="13" height="13"><use href="#i-x"/></svg>');
        c.onclick = () => {
          $$('.pfilter.on').forEach(p => { if (p.childNodes[0].textContent.trim() === l) p.classList.remove('on'); });
          $$('.fbox:not(.avail) .frow').forEach(r => { if (r.textContent.replace(/\(.*?\)/, '').trim() === l) $('.cb', r)?.classList.remove('on'); });
          applyFilters(); syncChips();
        };
        wrap.appendChild(c);
      });
      if (clear) wrap.appendChild(clear);
      if (!labels.length && clear) clear.style.display = 'none'; else if (clear) clear.style.display = '';
      syncOwnCta();
    }
    function clearAll() {
      $$('.pfilter.on').forEach(p => p.classList.remove('on'));
      $$('.fbox:not(.avail) .cb.on').forEach(c => c.classList.remove('on'));
      applyFilters(); syncChips(); toast('Filtre șterse');
    }
    const ca = $('.clear-all'); if (ca) ca.onclick = e => { e.preventDefault(); clearAll(); };

    /* --- sort --- */
    const sortBox = $('.sort-box');
    if (sortBox) {
      const m = el('div', 'menu');
      const opts = [['rec', 'Recomandate de noi'], ['price', 'Preț crescător'], ['pricedesc', 'Preț descrescător'], ['score', 'Cele mai bine notate'], ['beach', 'Cel mai aproape de plajă']];
      m.innerHTML = opts.map(o => '<div class="it' + (o[0] === 'rec' ? ' on' : '') + '" data-s="' + o[0] + '">' + o[1] + '</div>').join('');
      document.body.appendChild(m);
      sortBox.setAttribute('data-pop-anchor', '');
      sortBox.onclick = e => {
        e.stopPropagation();
        const was = m.classList.contains('open'); closeAllPops(); if (was) return;
        const r = sortBox.getBoundingClientRect();
        m.style.top = (r.bottom + window.scrollY + 8) + 'px';
        m.style.left = (r.right - 250) + 'px'; m.style.minWidth = '250px';
        m.classList.add('open'); openPop = m;
      };
      $$('.it', m).forEach(it => it.onclick = () => {
        $$('.it', m).forEach(x => x.classList.remove('on')); it.classList.add('on');
        sortBox.childNodes[2].textContent = ' ' + it.textContent + ' ';
        const main = $('.listing-grid main');
        const list = cards.slice().sort((a, b) => {
          const k = it.dataset.s;
          if (k === 'price') return (+a.dataset.total || 0) - (+b.dataset.total || 0);
          if (k === 'pricedesc') return (+b.dataset.total || 0) - (+a.dataset.total || 0);
          if (k === 'score') return (+b.dataset.score || 0) - (+a.dataset.score || 0);
          if (k === 'beach') return (+a.dataset.beach || 0) - (+b.dataset.beach || 0);
          /* „Recomandate de noi": inventarul propriu urcă — disponibilitatea e reală
             și confirmarea instantanee, deci e și cea mai bună experiență */
          return ((+b.dataset.own || 0) - (+a.dataset.own || 0)) || ((+a.dataset.rank || 0) - (+b.dataset.rank || 0));
        });
        const anchor = $('.pagerwrap', main) || $('.show-more', main);
        list.forEach(c => main.insertBefore(c, anchor));
        closeAllPops();
        toast('Sortat: ' + it.textContent, 'ok');
      });
    }

    /* --- facilities modal --- */
    const facLink = $$('.link-more').find(a => /toate facilitățile/i.test(a.textContent));
    if (facLink) facLink.onclick = e => {
      e.preventDefault();
      const groups = {
        'Plajă și piscine': [['Plajă privată', 35], ['Piscină exterioară', 26], ['Piscină pentru copii', 17], ['Piscină interioară', 2], ['Piscină încălzită', 6], ['Jacuzzi', 9]],
        'Familie': [['Loc de joacă', 31], ['Pătuț tip țarc', 37], ['Babysitting', 1], ['Cameră family', 44]],
        'Wellness și tratament': [['Spa', 10], ['Bază de tratament', 2], ['Saună', 11], ['Masaj', 8], ['Sală de fitness', 10], ['Beauty center', 3]],
        'Masă': [['All inclusive', 11], ['Restaurant', 58], ['Bar', 55], ['Room service', 10], ['Salon mic dejun', 3]],
        'Accesibilitate': [['Rampă de acces', 26], ['Cameră pentru persoane cu dizabilități', 11], ['Lift', 60]],
        'Servicii': [['Parcare', 70], ['Priză încărcare mașini electrice', 11], ['Internet wireless', 76], ['Recepție non-stop', 3], ['Self check-in', 1], ['Seif la recepție', 24], ['Schimb valutar', 7], ['Spălătorie', 5], ['Acceptă animale', 18]]
      };
      openModal('Toate facilitățile (48)', '<div class="fac-grid">' + Object.entries(groups).map(([g, items]) =>
        '<div class="g">' + g + '</div>' + items.map(([n, c]) =>
          '<label class="f"><span class="cb"></span>' + n + ' <span class="c">(' + c + ')</span></label>').join('')).join('') + '</div>');
      $$('.fac-grid .cb', modal).forEach(cb => cb.onclick = () => cb.classList.toggle('on'));
    };

    /* --- callback form --- */
    $$('.rescue').forEach(r => {
      const btn = $('.btn', r), inp = $('.inp', r);
      if (!btn || !inp) return;
      inp.contentEditable = 'true'; inp.classList.remove('ph');
      inp.dataset.ph = 'Numărul tău'; inp.textContent = '';
      inp.style.minWidth = '160px';
      const ph = el('span', '', 'Numărul tău'); ph.style.color = '#747679';
      inp.appendChild(ph);
      inp.onfocus = () => { if (inp.textContent.trim() === 'Numărul tău') inp.textContent = ''; inp.classList.add('focus'); };
      inp.onblur = () => inp.classList.remove('focus');
      btn.onclick = () => {
        const v = inp.textContent.replace(/\D/g, '');
        if (v.length < 9) { inp.classList.add('err'); return toast('Introdu un număr de telefon valid', 'err'); }
        inp.classList.remove('err');
        r.innerHTML = '<span class="ic" style="background:#13A260"><svg width="22" height="22"><use href="#i-check-g"/></svg></span>' +
          '<div><div class="t">Te sunăm în maximum 15 minute</div>' +
          '<div class="d">Un consultant verifică tot inventarul nostru pentru ' + fmtRange(S.from, S.to) + ' și te sună la ' + v + '.</div></div>';
        toast('Cererea de apel a fost trimisă', 'ok');
      };
    });

    /* --- nearby resorts --- */
    $$('.near-card').forEach(c => c.onclick = () => {
      S.dest = $('.t', c).textContent.trim(); save();
      goto(listingHref() + qs());
    });

    /* --- demo: comutator de inventar (mult / puțin) — arată starea „multe" vs „puține" rezultate --- */
    /* starea inițială vine din primul buton (sau din cel marcat .on), altfel
       lista ar raporta cele 6 carduri demo în loc de mărimea reală a rezultatului */
    /* ?inv=many|some|few|zero fixează starea pentru export și pentru un link
       trimis pe chat — altfel starea „zero rezultate", adică exact locul unde
       cade lejerul, s-ar vedea doar cu un clic și n-ar ajunge într-o ramă de
       Figma. Cheile sunt aceleași ca pe mobil (proto-m.js), iar potrivirea se
       face pe data-cap, nu pe poziția butonului în markup. */
    const INV_CAP = { many: 99, some: 4, few: 2, zero: 0 };
    const invWanted = INV_CAP[q.get('inv')];
    const invFirst = (invWanted != null && $('.invdemo [data-cap="' + invWanted + '"]'))
      || $('.invdemo [data-cap].on') || $('.invdemo [data-cap]');
    if (invFirst) {
      $$('.invdemo [data-cap]').forEach(x => x.classList.remove('on'));
      invFirst.classList.add('on');
      demoCap = +invFirst.dataset.cap; demoCount = +invFirst.dataset.count;
      setUrlState('inv', ({ 99: 'many', 4: 'some', 2: 'few', 0: 'zero' })[demoCap] || 'many');
    }
    $$('.invdemo [data-cap]').forEach(b => b.onclick = () => {
      $$('.invdemo [data-cap]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      demoCap = +b.dataset.cap; demoCount = +b.dataset.count;
      setUrlState('inv', ({ 99: 'many', 4: 'some', 2: 'few', 0: 'zero' })[demoCap] || 'many');
      $$('.pfilter.on').forEach(p => p.classList.remove('on'));       // curăță filtrele pt. o demonstrație curată
      $$('.fbox:not(.avail) .cb.on').forEach(c => c.classList.remove('on'));
      applyFilters(); syncChips();
      toast('Inventar demo: ' + b.textContent.trim(), 'ok');
    });

    applyFilters(); syncChips();
  }

  function rerunSearch() {
    const main = $('.listing-grid main');
    if (!main) return;
    spin.classList.add('on');
    setTimeout(() => {
      spin.classList.remove('on');
      const h1 = $('.listing-head h1'); if (h1) h1.textContent = 'Cazare ' + S.dest;
      repriceEverything();
      toast('Rezultate pentru ' + S.dest + ', ' + fmtRange(S.from, S.to), 'ok');
    }, 520);
  }

  /* ============================================================
     HOTEL PAGE
     ============================================================ */
  function initHotel() {
    if (document.body.dataset.page !== 'hotel') return;

    /* --- title from state --- */
    const t = $('.hp-title');
    if (t && S.hotel) t.childNodes[0].textContent = S.hotel + ' ';

    /* --- galeria în doi pași: 1. mozaicul cu toate pozele, 2. imaginea mare + banda de miniaturi --- */
    const photos = $$('.gallery img').map(i => i.getAttribute('src'));
    const extra = ['assets/pool-sunset.jpg', 'assets/coastline.jpg', 'assets/lobby.jpg', 'assets/spa-indoor.jpg', 'assets/apartment-family.jpg'];
    const gKey = s => (s.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
    const GCAT = {
      'pool-rooftop': 'pool', 'pool-sunset': 'pool', 'jacuzzi-view': 'pool',
      'coastline': 'beach', 'aerial-hotel': 'hotel', 'aerial-portrait': 'hotel', 'lobby': 'hotel',
      'room-seaview': 'rooms', 'room-double': 'rooms', 'apartment-family': 'rooms', 'spa-indoor': 'spa'
    };
    const GCAP = {
      'pool-rooftop': ['Piscina de pe terasă', 'The rooftop pool'],
      'room-seaview': ['Cameră dublă cu vedere la mare', 'Double room, sea view'],
      'aerial-hotel': ['Complexul văzut de sus', 'The complex from above'],
      'aerial-portrait': ['Poziția față de plajă', 'Where it sits on the beach'],
      'jacuzzi-view': ['Jacuzzi cu vedere la mare', 'Jacuzzi with a sea view'],
      'room-double': ['Cameră dublă standard', 'Standard double room'],
      'pool-sunset': ['Piscina exterioară la apus', 'The outdoor pool at sunset'],
      'coastline': ['Plaja Mamaia, la 50 m', 'Mamaia beach, 50 m away'],
      'lobby': ['Recepția și lobby-ul', 'Reception and lobby'],
      'spa-indoor': ['Zona de spa și piscina interioară', 'Spa area and indoor pool'],
      'apartment-family': ['Apartament familial, 4 persoane', 'Family apartment, 4 people']
    };
    /* Fotografii și clipuri încărcate de turiști. În prototip refolosesc pozele din assets,
       cu alt cadraj (object-position), ca să nu pară aceeași imagine pusă de două ori. */
    const GUEST = [
      { src: 'assets/coastline.jpg', pos: '70% 40%', by: 'Ana M.', when: ['august 2025', 'August 2025'], video: 1, dur: '0:24', cap: ['Plaja la 8 dimineața, filmat de la balcon', 'The beach at 8am, filmed from our balcony'] },
      { src: 'assets/pool-sunset.jpg', pos: '20% 70%', by: 'Radu P.', when: ['iulie 2025', 'July 2025'], cap: ['Piscina seara, fără aglomerație', 'The pool in the evening, nice and quiet'] },
      { src: 'assets/apartment-family.jpg', pos: '80% 50%', by: 'Ioana T.', when: ['august 2025', 'August 2025'], cap: ['Apartamentul nostru, etaj 4', 'Our apartment on the 4th floor'] },
      { src: 'assets/aerial-portrait.jpg', pos: '50% 25%', by: 'Cristian D.', when: ['iunie 2025', 'June 2025'], video: 1, dur: '0:41', cap: ['Drumul de la hotel până în apă', 'The walk from the hotel down to the water'] },
      { src: 'assets/room-double.jpg', pos: '25% 60%', by: 'Elena B.', when: ['septembrie 2025', 'September 2025'], cap: ['Camera exact ca în poze', 'The room, exactly like the photos'] },
      { src: 'assets/lobby.jpg', pos: '75% 60%', by: 'Mihai V.', when: ['iulie 2025', 'July 2025'], cap: ['Check-in în 5 minute', 'Checked in within 5 minutes'] }
    ];
    const GCHIPS = [
      ['all', ['Toate', 'All']], ['rooms', ['Camere', 'Rooms']], ['pool', ['Piscine', 'Pools']],
      ['beach', ['Plajă', 'Beach']], ['spa', ['Spa & wellness', 'Spa & wellness']], ['hotel', ['Hotel', 'The property']],
      ['guest', ['De la turiști', 'From guests']]
    ];
    const PLAY_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
    const CAM_SVG = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const VID_SVG = '<svg viewBox="0 0 24 24" width="12" height="12"><rect x="3" y="6" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 12 5-3v9l-5-3z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

    const GALLERY = photos.concat(extra).filter((s, i, a) => a.indexOf(s) === i)
      .map(src => ({ src: src, cat: GCAT[gKey(src)] || 'hotel', cap: (GCAP[gKey(src)] || ['', ''])[EN() ? 1 : 0] }))
      .concat(GUEST.map(g => ({
        src: g.src, cat: 'guest', video: g.video, dur: g.dur, by: g.by, pos: g.pos,
        when: g.when[EN() ? 1 : 0], cap: g.cap[EN() ? 1 : 0]
      })));
    GALLERY.forEach(it => { const im = new Image(); im.src = it.src; });

    let gView = [], gi = 0, gFilter = 'all';

    function galleryRail() {
      const cap = $('.review-cap');
      const score = cap ? ($('.rate-badge', cap) || {}).textContent : '9.2';
      const word = cap ? ($('.w .a', cap) || {}).textContent : '';
      const cnt = cap ? ($('.w .b', cap) || {}).textContent : '';
      const quotes = $$('.rev-card').slice(0, 2).map(c => ({
        q: (($('p', c) || {}).textContent || '').trim(),
        nm: (($('.nm', c) || {}).textContent || '').trim(),
        sc: (($('.sc', c) || {}).textContent || '').trim()
      })).filter(x => x.q);
      const price = ($('.book-card .price') || {}).textContent || '';
      const note = ($('.book-card .price-note') || {}).textContent || '';
      return '<div class="lb-score"><span class="rate-badge">' + (score || '9.2') + '</span>' +
        '<div><b>' + (word || '') + '</b><span>' + (cnt || '') + '</span></div></div>' +
        (quotes.length ? '<div class="lb-qhead">' + lang('Ce spun oaspeții', 'What guests say') + '</div>' +
          quotes.map(x => '<div class="lb-quote"><p>' + x.q + '</p><span>' + x.nm + (x.sc ? ' · ' + x.sc : '') + '</span></div>').join('') : '') +
        '<div class="lb-buy"><div class="p">' + lang('de la ', 'from ') + '<b>' + price.trim() + '</b></div>' +
        '<div class="n">' + note.trim() + '</div>' +
        '<button class="btn btn-primary lb-go">' + lang('Vezi camerele', 'See the rooms') + '</button></div>';
    }

    function toRooms() {
      closeModal();
      const sec = $('#camere');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function openGallery(filter) {
      gFilter = filter || 'all';
      modal.className = 'modal lb step-grid';
      modal.innerHTML =
        '<div class="modal-head">' +
        '<button class="lb-back">‹ ' + lang('Toate fotografiile', 'All photos') + '</button>' +
        '<h3></h3>' +
        '<div class="lb-head-r"><button class="btn btn-primary lb-book">' + lang('Vezi camerele', 'See the rooms') + '</button>' +
        '<span class="x">✕</span></div></div>' +
        '<div class="modal-body lb-body"><div class="lb-col">' +
        '<div class="lb-chips"></div><div class="lb-grid"></div>' +
        '<div class="lb-single"><div class="lb-main"><img alt="">' +
        '<span class="lb-nav prev">‹</span><span class="lb-nav next">›</span><span class="lb-count"></span>' +
        '<span class="lb-play-big">' + PLAY_SVG + '</span></div>' +
        '<div class="lb-cap"></div><div class="lb-strip"></div></div>' +
        '</div><aside class="lb-side">' + galleryRail() + '</aside></div>';
      $('h3', modal).textContent = (S.hotel || 'Complex Mediteranean') + ' — ' +
        lang(GALLERY.length + ' fotografii', GALLERY.length + ' photos');
      ov.classList.add('open');
      $('.x', modal).onclick = closeModal;
      $('.lb-book', modal).onclick = toRooms;
      const go = $('.lb-go', modal); if (go) go.onclick = toRooms;

      const chips = $('.lb-chips', modal), grid = $('.lb-grid', modal);
      const img = $('.lb-main img', modal), cnt = $('.lb-count', modal);
      const capBox = $('.lb-cap', modal), strip = $('.lb-strip', modal);
      const bigPlay = $('.lb-play-big', modal);

      const tag = it => it.cat === 'guest'
        ? '<span class="lb-tag">' + (it.video ? VID_SVG : CAM_SVG) + (EN() ? 'Guest' : 'Turist') + '</span>' : '';

      /* pasul 1 — mozaicul */
      function paintGrid() {
        chips.innerHTML = GCHIPS
          .filter(c => c[0] === 'all' || GALLERY.some(i => i.cat === c[0]))
          .map(c => '<button class="lb-chip' + (c[0] === gFilter ? ' on' : '') + '" data-c="' + c[0] + '">' +
            c[1][EN() ? 1 : 0] + ' <b>' + (c[0] === 'all' ? GALLERY.length : GALLERY.filter(i => i.cat === c[0]).length) + '</b></button>').join('');
        gView = gFilter === 'all' ? GALLERY.slice() : GALLERY.filter(i => i.cat === gFilter);
        grid.innerHTML = gView.map((it, i) =>
          '<div class="lb-cell' + (i % 7 === 0 ? ' big' : '') + '" data-i="' + i + '">' +
          '<img src="' + it.src + '" alt=""' + (it.pos ? ' style="object-position:' + it.pos + '"' : '') + '>' + tag(it) +
          (it.video ? '<span class="lb-play">' + PLAY_SVG + '<b>' + it.dur + '</b></span>' : '') +
          (it.cap ? '<span class="cap">' + it.cap + '</span>' : '') + '</div>').join('');
        $$('.lb-chip', modal).forEach(c => c.onclick = () => { gFilter = c.dataset.c; paintGrid(); });
        $$('.lb-cell', modal).forEach(c => c.onclick = () => openOne(+c.dataset.i));
      }

      /* pasul 2 — imaginea mare + banda orizontală */
      function paintOne() {
        const it = gView[gi];
        img.src = it.src;
        img.style.objectPosition = it.pos || '';
        cnt.textContent = (gi + 1) + ' / ' + gView.length;
        bigPlay.style.display = it.video ? 'flex' : 'none';
        capBox.innerHTML = '<div class="t">' + (it.cap || '') + '</div>' +
          (it.cat === 'guest'
            ? '<div class="by"><span class="av">' + it.by.charAt(0) + '</span>' +
            lang('Încărcat de ', 'Uploaded by ') + '<b>' + it.by + '</b> · ' + it.when +
            (it.video ? ' · ' + lang('clip ', 'clip ') + it.dur : '') + '</div>'
            : '<div class="by pro">' + lang('Fotografie oficială a proprietății', 'Official property photo') + '</div>');
        strip.innerHTML = gView.map((x, i) =>
          '<span class="lb-th' + (i === gi ? ' on' : '') + '" data-i="' + i + '"><img src="' + x.src + '" alt=""' +
          (x.pos ? ' style="object-position:' + x.pos + '"' : '') + '>' +
          (x.video ? '<i>' + PLAY_SVG + '</i>' : '') + '</span>').join('');
        $$('.lb-th', modal).forEach(x => x.onclick = () => { gi = +x.dataset.i; paintOne(); });
        const on = $('.lb-th.on', modal);
        if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
      function openOne(i) {
        gi = i;
        modal.classList.remove('step-grid'); modal.classList.add('step-one');
        paintOne();
        modal.scrollTop = 0;
      }
      function backToGrid() {
        modal.classList.remove('step-one'); modal.classList.add('step-grid');
        modal.scrollTop = 0;
      }
      $('.lb-back', modal).onclick = backToGrid;
      $('.prev', modal).onclick = () => { gi = (gi - 1 + gView.length) % gView.length; paintOne(); };
      $('.next', modal).onclick = () => { gi = (gi + 1) % gView.length; paintOne(); };
      bigPlay.onclick = () => toast(lang('În prototip clipurile nu rulează', 'Clips do not play in the prototype'));
      modal.onkeydown = null;
      paintGrid();
    }
    /* săgeți stânga/dreapta doar în pasul 2 */
    document.addEventListener('keydown', e => {
      if (!ov.classList.contains('open') || !modal.classList.contains('step-one')) return;
      if (e.key === 'ArrowLeft') { const p = $('.lb-nav.prev', modal); if (p) p.click(); }
      if (e.key === 'ArrowRight') { const n = $('.lb-nav.next', modal); if (n) n.click(); }
    });
    const hero = $('.gallery .hero');
    if (hero) hero.onclick = () => openGallery();
    $$('.thumbs .th').forEach(th => th.onclick = () => openGallery());
    const thMore = $('.thumbs .th-more');
    if (thMore && !$('.more-lbl', thMore)) {
      thMore.appendChild(el('span', 'more-lbl', '+' + (GALLERY.length - 5) + ' ' + lang('fotografii', 'photos')));
    }
    /* butonul „toate fotografiile" peste imaginea mare */
    if (hero && !$('.g-all', hero)) {
      const gAll = el('button', 'g-all', lang('Vezi toate cele ' + GALLERY.length + ' fotografii', 'See all ' + GALLERY.length + ' photos'));
      gAll.onclick = e => { e.stopPropagation(); openGallery(); };
      hero.appendChild(gAll);
    }
    /* Săgeți pe imaginea mare, ca pe cardurile din listing: răsfoiești pozele
       proprietății fără să deschizi galeria. Clicul pe imagine deschide în
       continuare mozaicul, deci săgețile opresc propagarea. Pozele turiștilor
       rămân doar în galerie — aici arătăm ce a fotografiat proprietatea. */
    if (hero && !$('.hero-nav', hero)) {
      const hImg = $('img', hero);
      const own = GALLERY.filter(g => g.cat !== 'guest');
      if (hImg && own.length > 1) {
        const cnt = el('span', 'hero-count');
        let hi = Math.max(0, own.findIndex(g => g.src === hImg.getAttribute('src')));
        const show = i => {
          hi = (i + own.length) % own.length;
          hImg.src = own[hi].src;
          hImg.style.objectPosition = own[hi].pos || '';
          cnt.textContent = (hi + 1) + ' / ' + own.length;
        };
        const arrow = (cls, glyph, step, label) => {
          const b = el('button', 'hero-nav ' + cls, glyph);
          b.type = 'button';
          b.setAttribute('aria-label', label);
          b.onclick = e => { e.stopPropagation(); show(hi + step); };
          return b;
        };
        hero.appendChild(arrow('prev', '‹', -1, lang('Poza anterioară', 'Previous photo')));
        hero.appendChild(arrow('next', '›', 1, lang('Poza următoare', 'Next photo')));
        hero.appendChild(cnt);
        show(hi);
        own.forEach(g => { const im = new Image(); im.src = g.src; });
      }
    }
    /* banda de fotografii de la turiști și pozele din recenzii deschid mozaicul filtrat */
    $$('.ugc-strip .ugc-tile, .ugc-more, .rev-ph span').forEach(x => x.onclick = e => { e.preventDefault(); openGallery('guest'); });
    $$('[data-ugc-add]').forEach(b => b.onclick = ugcUploadModal);
    $$('[data-ugc-review]').forEach(b => b.onclick = reviewModal);
    const gShare = $$('.g-actions span')[1];
    if (gShare) gShare.onclick = e => { e.stopPropagation(); navigator.clipboard?.writeText(location.href); toast('Link copiat', 'ok'); };
    const gHeart = $$('.g-actions span')[0];
    if (gHeart) gHeart.onclick = e => { e.stopPropagation(); gHeart.classList.toggle('on'); toast(gHeart.classList.contains('on') ? 'Adăugat la favorite' : 'Eliminat din favorite'); };

    /* --- meal chips filter the rate rows --- */
    $$('.mchip').forEach(ch => ch.onclick = () => {
      $$('.mchip').forEach(c => c.classList.remove('on'));
      ch.classList.add('on');
      const want = ch.textContent.trim().toLowerCase();
      let shown = 0;
      $$('tr[data-meal]').forEach(tr => {
        const ok = want === 'toate' || (tr.dataset.meal || '').toLowerCase().includes(want);
        tr.classList.toggle('rate-hidden', !ok);
        if (ok) shown++;
      });
      $$('.room-card').forEach(rc => {
        const any = $$('tr[data-meal]:not(.rate-hidden)', rc).length;
        rc.style.display = any ? '' : 'none';
      });
      autoFlexi();
      toast(shown ? shown + ' tarife cu „' + ch.textContent.trim() + '”' : 'Niciun tarif pentru această opțiune', shown ? 'ok' : 'err');
    });

    /* flexi-strip: extins când sunt puține camere disponibile, altfel colapsat (doar text de rozklik) */
    function autoFlexi() {
      const fstrip = $('.flexi-strip'); if (!fstrip) return;
      const avail = $$('.room-card tr[data-ppn]:not(.rate-request):not(.rate-hidden)').length;
      fstrip.classList.toggle('collapsed', avail > 3);
      const t = $('.flexi-toggle', fstrip);
      if (t) t.textContent = fstrip.classList.contains('collapsed') ? 'vezi prețurile ▾' : 'ascunde ▴';
    }

    /* --- rate selection: „Alege" → stepper (± nr. camere) → belă de rezervare care urcă (model Szallas) --- */
    const bookBar = $('.booking-bar');
    if (bookBar) {
      const sel = {}; // rid -> qty
      const onlineRows = () => $$('tr[data-ppn]:not(.rate-request)');
      onlineRows().forEach((tr, i) => { tr.dataset.rid = 'rr' + i; });
      const rowOf = rid => $('tr[data-rid="' + rid + '"]');
      const info = tr => ({
        name: tr.closest('.room-card').querySelector('h3').textContent.trim(),
        board: tr.dataset.meal || 'mic dejun',
        price: +(tr.dataset.total || (+tr.dataset.ppn || 578) * 7)
      });
      const totalRooms = () => Object.values(sel).reduce((a, q) => a + q, 0);
      const totalPrice = () => Object.entries(sel).reduce((a, [rid, q]) => a + q * info(rowOf(rid)).price, 0);

      function renderRates() {
        onlineRows().forEach(tr => {
          const rid = tr.dataset.rid, q = sel[rid] || 0, cell = tr.lastElementChild;
          tr.classList.toggle('sel', q > 0);
          if (q > 0) {   // doar camerele deja alese arată stepperul ± ; restul rămân buton „Adaugă cameră"
            cell.innerHTML = '<div class="rate-stepper"><button class="mn" aria-label="Scade">−</button>' +
              '<span class="n">' + q + '</span><button class="pl" aria-label="Adaugă"' + (q >= 4 ? ' disabled' : '') + '>+</button></div>';
            $('.mn', cell).onclick = () => { sel[rid] = q - 1; if (!sel[rid]) delete sel[rid]; sync(); };
            $('.pl', cell).onclick = () => { if (q < 4) { sel[rid] = q + 1; sync(); } };
          } else {
            cell.innerHTML = (EN()?'<button class="btn btn-primary btn-select">Add room</button>':'<button class="btn btn-primary btn-select">Adaugă cameră</button>');
            $('.btn-select', cell).onclick = () => { sel[rid] = 1; sync(); toast('Cameră adăugată în rezervare', 'ok'); };
          }
        });
      }
      function renderBar() {
        const rooms = totalRooms();
        bookBar.classList.toggle('show', rooms > 0);
        const summ = $('.bb-summary', bookBar);
        if (summ) summ.innerHTML = rooms
          ? Object.entries(sel).map(([rid, q]) => { const it = info(rowOf(rid));
              return '<div class="row"><span class="q">' + q + '×</span> <span class="nm">' + it.name + '</span> <span class="bd">(' + it.board + ')</span></div>'; }).join('')
          : (EN()?'<div class="empty">No room selected</div>':'<div class="empty">Nicio cameră selectată</div>');
        const bp = $('.bb-price', bookBar); if (bp) bp.textContent = money(totalPrice());
        const br = $('.bb-rooms', bookBar); if (br) br.textContent = rooms;
      }
      function sync() { renderRates(); renderBar(); }   // selecția din belă e efemeră, nu suprascrie camerele din căutare
      renderRates(); renderBar();
      const bbCta = $('.bb-cta', bookBar);
      if (bbCta) bbCta.onclick = () => {
        if (!totalRooms()) return;
        const first = rowOf(Object.keys(sel)[0]);
        S.rate = info(first).name; S.meal = info(first).board; S.ratePrice = totalPrice();
        save(); goto(en('checkout.html') + qs());
      };
    }

    /* --- rate „la cerere" (indisponibil online) → consultant / callback (phone-as-a-scalpel) --- */
    $$('.btn-request').forEach(b => b.onclick = () => {
      const tr = b.closest('tr');
      const rtitle = (($('.ch b', tr) || {}).textContent || tr.closest('.room-card').querySelector('h3').textContent).trim();
      openModal('La cerere · ' + rtitle,
        '<p>Această cameră nu se poate rezerva instant online pentru <b>' + fmtRange(S.from, S.to) + '</b>. ' +
        'Un consultant îți verifică disponibilitatea în inventarul nostru propriu și îți confirmă în cel mai scurt timp.</p>' +
        '<p style="margin-top:6px"><b>Sună acum:</b> <span style="font-family:var(--font-title);font-weight:800;color:#004B97;font-size:19px">0241 999</span> · zilnic 10:00–18:00</p>' +
        '<div class="assist" style="border-color:#8FB0D2;align-items:flex-start"><span class="cb"></span>' +
        '<div style="flex:1"><b>Sau lasă-ne numărul și te sunăm noi</b>' +
        '<div class="d">Verificăm disponibilitatea pentru datele tale și îți trimitem link de plată dacă e liber.</div>' +
        '<div class="callback" style="margin-top:9px"><span class="inp req-inp" style="width:170px;display:inline-flex"></span>' +
        '<button class="btn btn-primary req-send" style="height:42px;padding:0 16px">Cere să fii sunat</button></div></div></div>');
      const inp = $('.req-inp', modal), send = $('.req-send', modal);
      if (inp) { inp.contentEditable = 'true'; inp.textContent = 'Numărul tău'; inp.classList.add('ph');
        inp.onfocus = () => { if (inp.classList.contains('ph')) { inp.textContent = ''; inp.classList.remove('ph'); } inp.classList.add('focus'); };
        inp.onblur = () => inp.classList.remove('focus'); }
      if (send) send.onclick = () => {
        const v = (inp.textContent || '').replace(/\D/g, '');
        if (v.length < 9) { inp.classList.add('err'); return toast('Introdu un număr de telefon valid', 'err'); }
        closeModal();
        toast('Te sunăm în maximum 15 minute pentru „' + rtitle + '”', 'ok');
      };
    });

    /* --- book now: derulează la selecția camerelor (nu direct la checkout) --- */
    /* Înainte de a alege o cameră nu există „rezervă" — butonul duce la
       selecția camerelor și o evidențiază, ca să fie clar unde ai ajuns. */
    const bkCta = $('.bk-cta');
    if (bkCta) bkCta.onclick = () => {
      const target = $('.room-card') || $('.meal-chips') || $('.stay-bar');
      if (target) {
        window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
        target.classList.add('co-focus');
        setTimeout(() => target.classList.remove('co-focus'), 1600);
      }
      toast(lang('Alege camera și tariful dorit', 'Choose your room and rate'), 'ok');
    };

    /* --- modals: campaigns, cancellation, room details --- */
    $$('.camp-strip .go').forEach(g => g.onclick = () => {
      const strip = g.closest('.camp-strip');
      openModal($('.t', strip).textContent, '<p>' + $('.d', strip).textContent + '</p>' +
        '<p><b>Condiții:</b> campania este organizată de LitoralulRomanesc.ro împreună cu hotelurile participante. ' +
        'Înscrierea este automată pentru rezervările care îndeplinesc condiția de mai sus și sunt finalizate (sejur efectuat).</p>' +
        '<p>Câștigătorii sunt anunțați pe adresa de e-mail din rezervare. Premiul nu poate fi transformat în bani.</p>');
    });
    $$('.prog-green, .prog-orange').forEach(p => p.onclick = () => {
      if (/ANULARE/i.test(p.textContent)) {
        openModal('Programul ANULARE GRATUITĂ', '<p>Poți anula gratuit rezervarea dacă trimiți solicitarea cu <b>cel puțin 10 zile înainte de check-in</b>.</p>' +
          '<p>Condiții: se aplică rezervărilor cu <b>ofertă standard</b>, achitate integral. Fiecare solicitare este analizată individual de un consultant.</p>' +
          '<p>După acest termen se reține avansul. Creditele FRIENDS aferente rezervării se anulează.</p>');
      } else {
        openModal('Plata cu card de vacanță', '<p>Acceptăm carduri de vacanță <b>Edenred, Pluxee și Up România</b> pentru toate hotelurile de pe site.</p>' +
          '<p>Voucherele au plafon anual, așa că diferența până la valoarea sejurului se achită cu cardul bancar — o calculăm automat la checkout.</p>');
      }
    });
    $$('.rlink').forEach(r => r.onclick = e => {
      e.preventDefault();
      const card = r.closest('.room-card');
      openModal($('h3', card).textContent, '<p><b>Suprafață:</b> 24 m² · <b>Paturi:</b> 1 pat dublu sau 2 paturi separate (repartizarea se face la recepție)</p>' +
        '<p><b>Capacitate maximă:</b> 2 adulți + 1 copil 0–13,99 ani, sau 3 adulți. Pentru confort sporit recomandăm un pat suplimentar.</p>' +
        '<p><b>Dotări:</b> aer condiționat, balcon, TV LED, internet wireless gratuit, răcitor, telefon intern, baie proprie cu duș, acces pe bază de card magnetic, plasă de țânțari.</p>' +
        '<p style="color:#57585A;font-size:13px">Descrierile provin de la partenerii hotelieri și pot suferi modificări.</p>');
    });
    const cheapBtn = $('.cheapest .btn');
    if (cheapBtn) cheapBtn.onclick = () => {
      S.from = '2026-09-06'; S.to = '2026-09-12'; save();
      repriceEverything(); initSearch();
      toast('Date schimbate pe 6–12 septembrie · Litoralul Pentru Toți', 'ok');
      window.scrollTo({ top: $('.flexi-strip').offsetTop - 120, behavior: 'smooth' });
    };
    /* --- stay-bar: editare inline a datelor/oaspeților CHIAR AICI (fără redirect la search-ul de sus → listing) --- */
    const stayBar = $('.stay-bar');
    if (stayBar) {
      /* popoverele au nevoie de un părinte poziționat — dar nu suprascriem `sticky`,
         care ține bara lipită cât ține secțiunea de camere */
      if (getComputedStyle(stayBar).position === 'static') stayBar.style.position = 'relative';
      const sf = $$('.f', stayBar);
      const fdate = sf[0], fguests = sf[1], frooms = sf[2], modif = $('.btn', stayBar);
      const openD = e => { if (e) e.stopPropagation(); if (searchOpenCal) searchOpenCal(fdate || stayBar, stayBar); };
      const openG = e => { if (e) e.stopPropagation(); if (searchOpenGuests) searchOpenGuests(fguests || stayBar, stayBar); };
      [fdate, fguests, frooms].forEach(f => { if (f) { f.setAttribute('data-pop-anchor', ''); f.style.cursor = 'pointer'; } });
      if (fdate) fdate.onclick = openD;
      if (fguests) fguests.onclick = openG;
      if (frooms) frooms.onclick = openG;
      if (modif) { modif.setAttribute('data-pop-anchor', ''); modif.onclick = openD; }
    }

    /* --- flexi-strip pliabil: caption ca toggle + auto pe baza disponibilității --- */
    const fstrip = $('.flexi-strip');
    if (fstrip) {
      const cap = $('.cap', fstrip);
      if (cap && !$('.flexi-toggle', cap)) {
        cap.appendChild(el('span', 'flexi-toggle'));
        cap.style.cursor = 'pointer';
        cap.onclick = () => {
          fstrip.classList.toggle('collapsed');
          const t = $('.flexi-toggle', fstrip);
          if (t) t.textContent = fstrip.classList.contains('collapsed') ? 'vezi prețurile ▾' : 'ascunde ▴';
        };
      }
      autoFlexi();
    }

    /* --- info despre mese: „Ce include…" colapsat, apare la click pe link --- */
    const mealInfoLink = $('.meal-info-link'), mealDef = $('.meal-def');
    if (mealInfoLink && mealDef) mealInfoLink.onclick = () => {
      mealDef.classList.toggle('open');
      mealInfoLink.textContent = mealDef.classList.contains('open') ? 'Ascunde info despre mese ▴' : 'Vezi ce include fiecare masă ▾';
    };

    /* --- bara sticky de sus a fost eliminată: bara de rezervare de jos (.booking-bar) o dublează --- */
  }

  /* ============================================================
     CHECKOUT
     ============================================================ */
  function paintCheckout() {
    const total = S.ratePrice || 4046;
    const tax = Math.round(total / 1.19 * 0.01);
    const discounted = S.promo ? Math.round(total * 0.9) : total;
    const advMin = Math.round(discounted * 0.3);   // avans minim acceptat = 30%
    let adv = advMin;
    if (S.payMode === 'advance' && S.advance != null) adv = Math.min(discounted, Math.max(advMin, S.advance));

    const set = (sel, html) => { const n = $(sel); if (n) n.innerHTML = html; };
    set('.pl.total .v', money(discounted) + ' <span style="font-size:15px">Lei</span>');
    const gross = Math.round(total / 0.85);
    const lines = $$('.price-lines .pl');
    if (lines[0]) $('.v', lines[0]).textContent = money(gross) + ' Lei';
    if (lines[1]) $('.v', lines[1]).textContent = '−' + money(gross - total) + ' Lei';
    const taxV = $('.athotel .pl .v'); if (taxV) taxV.textContent = '≈ ' + tax + ' Lei';
    const sp = $$('.split-box .pl');
    if (sp[0]) $('.v', sp[0]).textContent = money(S.payMode === 'full' ? discounted : adv) + ' Lei';
    if (sp[1]) $('.v', sp[1]).textContent = money(S.payMode === 'full' ? 0 : discounted - adv) + ' Lei';
    const cr = $('.sum-body .credits'); if (cr) cr.textContent = (EN()?'+ earn ':'+ câștigi ') + Math.round(discounted * 0.02) + (EN()?' FRIENDS credits after your stay':' credite FRIENDS după sejur');

    const boxes = $$('.pay-box');
    if (boxes[0]) { $('.p', boxes[0]).innerHTML = money(adv) + ' Lei <span style="font-size:13px;font-weight:700;color:#57585A">azi</span>'; $('.d', boxes[0]).textContent = 'Restul de ' + money(discounted - adv) + ' Lei — online până la 22 mai sau la hotel'; }
    // avans editabil: actualizează inputul (dacă nu e în editare) + min/max
    const advAmt = $('.adv-amt'), advMinN = $('.adv-min'), advMaxN = $('.adv-max');
    if (advMinN) advMinN.textContent = money(advMin) + ' Lei';
    if (advMaxN) advMaxN.textContent = money(discounted) + ' Lei';
    if (advAmt && document.activeElement !== advAmt) advAmt.textContent = money(adv);
    if (boxes[1]) $('.p', boxes[1]).textContent = money(discounted) + ' Lei';
    if (boxes[2]) $('.p', boxes[2]).innerHTML = '6 × ' + money(Math.round(discounted / 6)) + ' Lei <span style="font-size:13px;font-weight:700;color:#57585A">0% dobândă</span>';

    // summary room + stay
    const rn = $('.sum-body .hname'); if (rn && S.hotel) rn.childNodes[0].textContent = S.hotel + ' ';
    const rows = $$('.sum-meta .row');
    if (rows[0]) rows[0].innerHTML = rows[0].innerHTML.replace(/(<\/span>).*/, '$1 ' + fmtRange(S.from, S.to) + ' · ' + nights() + ' nopți');
    if (rows[1]) rows[1].innerHTML = rows[1].innerHTML.replace(/(<\/span>)[^<]*/, '$1 ' + guestsTxt() + (S.kids ? ' (' + S.ages.slice(0, S.kids).join(EN() ? ' & ' : ' și ') + (EN() ? ' yrs' : ' ani') + ')' : '') + ' ');
    if (rows[2]) rows[2].innerHTML = rows[2].innerHTML.replace(/(<\/span>).*/, '$1 ' + S.rooms + ' × ' + (S.rate || 'Cameră dublă vedere mare'));
    if (rows[3]) rows[3].innerHTML = rows[3].innerHTML.replace(/(<\/span>).*/, '$1 ' + (S.meal ? S.meal.charAt(0).toUpperCase() + S.meal.slice(1) + ' inclus' : 'Mic dejun inclus'));

    // voucher split
    const vBox = $('[data-voucher]');
    if (vBox) {
      const payNow = S.payMode === 'full' ? discounted : adv;
      const v = Math.min(S.voucher, payNow);
      const diffN = $('[data-voucher-diff]');
      if (diffN) diffN.innerHTML = '<b>' + money(payNow - v) + ' Lei</b> <span style="color:#747679;font-size:12.5px">din suma de ' + money(payNow) + ' Lei</span>';
    }
  }

  function initCheckout() {
    if (document.body.dataset.page !== 'checkout') return;
    const vBox0 = $('[data-voucher]');
    if (vBox0 && $('.cb', vBox0).classList.contains('on') && !S.voucher) { S.voucher = 800; save(); }
    paintCheckout();

    /* --- payment mode --- */
    $$('.pay-box').forEach((b, i) => b.onclick = e => {
      if (e.target.closest('.assist')) return;
      $$('.pay-box').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      S.payMode = i === 0 ? 'advance' : i === 1 ? 'full' : 'instalments';
      save(); paintCheckout();
      const cta = $('.cta-row .btn');
      if (cta) cta.childNodes[0].textContent = S.payMode === 'instalments' ? 'Trimite cererea de rezervare ' :
        S.payMode === 'full' ? 'Rezervă și plătește tot ' : 'Rezervă și plătește avansul ';
    });

    /* --- avans editabil (min. 30%, max total) --- */
    const advAmt = $('.adv-amt');
    if (advAmt) {
      advAmt.setAttribute('contenteditable', 'true');
      const stop = e => e.stopPropagation();
      advAmt.onmousedown = stop; advAmt.onclick = stop;
      advAmt.onfocus = () => {
        if (S.payMode !== 'advance') { S.payMode = 'advance'; save(); $$('.pay-box').forEach((x, i) => x.classList.toggle('on', i === 0)); paintCheckout(); }
      };
      advAmt.oninput = () => { S.advance = +((advAmt.textContent || '').replace(/\D/g, '') || 0); save(); paintCheckout(); };
      advAmt.onblur = () => { paintCheckout(); };   // rescrie inputul la valoarea clampată (min/max)
    }

    /* --- assist checkboxes --- */
    $$('.assist .cb').forEach(cb => cb.onclick = e => {
      e.stopPropagation(); cb.classList.toggle('on');
      const box = cb.closest('.assist');
      if (box.hasAttribute('data-voucher')) {
        box.style.opacity = cb.classList.contains('on') ? '1' : '.55';
        S.voucher = cb.classList.contains('on') ? 800 : 0; save(); paintCheckout();
      } else if (cb.classList.contains('on')) {
        toast('Un consultant te sună pentru linkul de plată în rate', 'ok');
      }
    });

    /* --- voucher amount editable --- */
    const vAmt = $('[data-voucher-amt]');
    if (vAmt) {
      vAmt.contentEditable = 'true';
      vAmt.onfocus = () => vAmt.classList.add('focus');
      vAmt.oninput = () => { S.voucher = +(vAmt.textContent.replace(/\D/g, '') || 0); save(); paintCheckout(); };
      vAmt.onblur = () => { vAmt.classList.remove('focus'); vAmt.innerHTML = '<b>' + money(S.voucher) + ' Lei</b>'; };
    }

    /* --- promo code --- */
    const promoBtn = $('.promo-row .btn'), promoInp = $('.promo-row .inp');
    if (promoBtn && promoInp) {
      promoInp.contentEditable = 'true'; promoInp.classList.remove('ph');
      promoInp.textContent = 'LITORAL10';
      promoInp.style.color = '#747679';
      promoInp.onfocus = () => { if (promoInp.style.color) { promoInp.textContent = ''; promoInp.style.color = ''; } promoInp.classList.add('focus'); };
      promoInp.onblur = () => promoInp.classList.remove('focus');
      promoBtn.onclick = () => {
        const code = promoInp.textContent.trim().toUpperCase();
        if (code === 'LITORAL10') {
          S.promo = code; save(); paintCheckout();
          const box = promoBtn.closest('.promo-box');
          box.innerHTML = '<div class="lbl" style="color:#0E804B"><svg width="15" height="15"><use href="#i-check-g"/></svg> Cod ' + code + ' aplicat — reducere 10%</div>';
          toast('Cod promo aplicat: −10%', 'ok');
        } else {
          promoInp.classList.add('err');
          toast('Cod invalid. Încearcă LITORAL10', 'err');
        }
      };
    }

    /* --- billing person type --- */
    $$('.seg span').forEach((sp, i, arr) => sp.onclick = () => {
      arr.forEach(x => x.classList.remove('on')); sp.classList.add('on');
      const extra = $('[data-company]');
      if (i === 1 && !extra) {
        const f2 = sp.closest('.form-card').querySelectorAll('.f2')[0];
        const row = el('div', 'f2'); row.setAttribute('data-company', '');
        row.innerHTML = '<div class="fld"><label>Denumire firmă</label><div class="inp ph">S.C. …</div></div>' +
          '<div class="fld"><label>CUI</label><div class="inp ph">RO…</div></div>';
        f2.before(row);
      } else if (i === 0 && extra) extra.remove();
    });

    /* --- consent gating --- */
    const cta = $('.cta-row .btn');
    const sumCta = $('.sum-cta');   // CTA-ul din caseta plutitoare de sumar (vizibil în primul viewport)
    const consents = $$('.consent .cb');
    function syncCta() {
      const ok = consents[0] && consents[0].classList.contains('on');
      if (cta) { cta.classList.toggle('btn-disabled', !ok); cta.classList.toggle('btn-primary', ok); }   // sumCta rămâne mereu portocaliu
      const hint = $('.cta-hint');
      if (hint) hint.style.visibility = ok ? 'hidden' : 'visible';
    }
    consents.forEach((cb, i) => cb.onclick = () => {
      cb.classList.toggle('on');
      if (i === 1) toast(cb.classList.contains('on') ? (EN() ? 'You subscribed to our offers' : 'Te-ai abonat la ofertele noastre') : (EN() ? 'Subscription cancelled' : 'Abonare anulată'));
      syncCta();
    });
    syncCta();
    const needConsent = () => toast(EN() ? 'Tick the terms to continue' : 'Bifează acceptarea condițiilor pentru a continua', 'err');
    const proceed = () => {
      if (S.promo) { S.ratePrice = Math.round((S.ratePrice || 4046) * 0.9); S.promo = null; }
      save(); goto(en('thankyou.html') + qs(), 900);
    };
    if (cta) cta.onclick = () => {
      if (cta.classList.contains('btn-disabled')) { $('.consent .cb')?.classList.add('err'); return needConsent(); }
      proceed();
    };
    // CTA-ul din sumar rămâne portocaliu și te plimbă pas cu pas prin secțiuni până la confirmare
    const walkSteps = $$('.form-card').filter(fc => !/opțional|optional/i.test(($('h2', fc) && $('h2', fc).textContent) || ''));
    const consentEl = $('.consent');
    if (consentEl) walkSteps.push(consentEl);
    let walkI = 0;
    if (sumCta) sumCta.onclick = () => {
      const consentOk = consents[0] && consents[0].classList.contains('on');
      if (walkI >= walkSteps.length) { if (consentOk) return proceed(); walkI = Math.max(0, walkSteps.length - 1); }
      const target = walkSteps[walkI];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $$('.co-focus').forEach(x => x.classList.remove('co-focus'));
        target.classList.add('co-focus');
        setTimeout(() => target.classList.remove('co-focus'), 1600);
        if (target.classList.contains('consent') && !consentOk) { $('.consent .cb')?.classList.add('err'); needConsent(); }
      }
      walkI++;
    };

    /* --- editable form fields --- */
    $$('.form-card .inp').forEach(i => {
      if (i.closest('.promo-row') || i.hasAttribute('data-voucher-amt')) return;
      i.contentEditable = 'true';
      i.onfocus = () => { i.classList.add('focus'); if (i.classList.contains('ph')) { i.textContent = ''; i.classList.remove('ph'); } };
      i.onblur = () => i.classList.remove('focus');
    });
    const ta = $('.textarea');
    if (ta) {
      ta.contentEditable = 'true';
      const cnt = $('.cnt-note');
      ta.onfocus = () => { if (!ta.dataset.touched) { ta.textContent = ''; ta.dataset.touched = '1'; ta.style.color = '#1E1E1E'; } };
      ta.oninput = () => { if (cnt) cnt.textContent = Math.min(250, ta.textContent.length) + ' / 250'; };
    }

    /* --- modify links --- */
    $$('.sum-meta a, .green-band a').forEach(a => a.onclick = e => {
      e.preventDefault();
      if (/reguli|condiții/i.test(a.textContent)) {
        openModal('Condiții de anulare', '<p>Anulare gratuită dacă trimiți solicitarea cu <b>cel puțin 10 zile înainte de check-in</b> (până la 26 mai).</p>' +
          '<p>Se aplică ofertelor standard, cu rezervarea achitată integral. Fiecare solicitare este analizată individual.</p><p>După acest termen se reține avansul.</p>');
      } else goto(en('hotel.html') + qs());
    });
  }

  /* ============================================================
     THANK YOU
     ============================================================ */
  function initThanks() {
    if (document.body.dataset.page !== 'thankyou') return;
    const total = S.ratePrice || 4046;
    const paid = S.payMode === 'full' ? total : Math.round(total * 0.3);
    const due = total - paid;
    const cells = $$('.paystate .cell');
    if (cells[0]) { $('.v', cells[0]).textContent = money(paid) + ' Lei'; $('.l', cells[0]).textContent = S.payMode === 'full' ? 'Plătit azi (integral)' : 'Plătit azi (avans 30%)'; }
    if (cells[1]) { $('.v', cells[1]).textContent = money(due) + ' Lei'; if (!due) cells[1].style.opacity = '.5'; }
    const band = $('.ty-band');
    if (band) band.innerHTML = due
      ? '<b>Avansul de ' + money(paid) + ' Lei a fost plătit.</b> Restul de ' + money(due) + ' Lei îl poți plăti online până la 22 mai sau direct la hotel, la check-in.'
      : '<b>Rezervarea este achitată integral (' + money(paid) + ' Lei).</b> Nu mai ai nimic de plătit la hotel, în afara taxei de stațiune.';
    const hn = $('.sum-body .hname'); if (hn && S.hotel) hn.childNodes[0].textContent = S.hotel + ' ';
    const tot = $('.pl.total .v'); if (tot) tot.innerHTML = money(total) + ' <span style="font-size:15px">Lei</span>';
    const cr = $('.friends-earn div div');
    if (cr) cr.innerHTML = '+' + Math.round(total * 0.02) + ' credite FRIENDS după sejur · nivel <b>Friend</b> (2%)';

    $$('.doc .go').forEach(g => g.onclick = () => toast(/curând/i.test(g.textContent) ? 'Factura se emite în 24h' : 'În prototip: descărcare ' + $('.t', g.closest('.doc')).textContent, 'ok'));
    $$('.ty-actions .btn').forEach(b => b.onclick = () => toast('În prototip: ' + b.textContent.trim()));
    const payRest = $('.form-card .btn-primary');
    if (payRest) payRest.onclick = () => {
      if (!due) return toast('Rezervarea este deja achitată integral', 'ok');
      openModal('Plătește restul de ' + money(due) + ' Lei', '<p>Alege metoda de plată:</p>' +
        '<div class="pm-row"><span class="pm hl">💳 Card online</span><span class="pm">Transfer bancar</span><span class="pm hl">Card de vacanță</span><span class="pm">6 rate fără dobândă</span></div>' +
        '<p style="margin-top:14px">După plată primești automat factura și voucherul actualizat pe e-mail.</p>');
    };
    const storno = $('.camp-strip .go');
    if (storno) storno.onclick = () => openModal('Asigurare storno', '<p>Îți recuperezi banii investiți în sejur dacă anulezi din motive medicale, accident, urgență în familie sau pierderea locului de muncă.</p>' +
      '<p><b>Termen:</b> polița trebuie emisă înainte de începerea sejurului și în maximum 3 zile lucrătoare de la rezervare, dacă sejurul începe în mai puțin de 30 de zile.</p>' +
      '<p>Prima se calculează în funcție de valoarea sejurului. Un consultant îți trimite oferta pe e-mail.</p>');
  }

  /* ============================================================
     GENERIC — carousels, links, hint bar
     ============================================================ */
  function initGeneric() {
    /* carousel arrows */
    $$('.sec-nav').forEach(nav => {
      const sec = nav.closest('.section');
      const row = $('.insp-row, .hcard-row, .camp-row, .prev-row', sec);
      if (!row) return;
      row.style.overflowX = 'auto'; row.style.scrollBehavior = 'smooth';
      const btns = $$('.nav-btn', nav);
      btns[0].onclick = () => row.scrollBy({ left: -420 });
      btns[1].onclick = () => row.scrollBy({ left: 420 });
    });

    /* home tiles → listing */
    $$('.insp-card, .mz, .prev-card, .resort-index a').forEach(c => c.onclick = e => {
      e.preventDefault();
      const cap = $('.cap, .t', c);
      const txt = (cap ? cap.textContent : c.textContent).trim();
      /* cel mai lung nume care se potrivește, altfel „Mamaia Nord” ar cădea pe „Mamaia” */
      const match = RESORTS.filter(r => txt.startsWith(r[0])).sort((a, b) => b[0].length - a[0].length)[0];
      if (match) S.dest = match[0];
      save(); goto(listingHref() + qs());
    });

    /* Cardurile de hotel duc la pagina hotelului, pe orice pagină ar sta — secțiunile de pe home
       („garantate de noi”, campanii, „all inclusive”). Cablajul stătea în initHotel, unde era cod mort:
       hotel.html nu mai are niciun .hcard de când i-a plecat banda de hoteluri din apropiere. */
    $$('.hcard').forEach(c => c.onclick = e => {
      if (e.target.closest('.heart, .own-badge, a')) return;
      const h = $('.hname', c);
      if (h) S.hotel = h.childNodes[0].textContent.trim();
      save(); goto(en('hotel.html') + qs());
    });

    /* favoritele: erau cablate doar în initListing, deci inimile de pe home nu răspundeau */
    $$('.heart').forEach(h => h.onclick = e => {
      e.stopPropagation(); h.classList.toggle('on');
      const on = h.classList.contains('on');
      toast(on ? lang('Adăugat la favorite', 'Added to favourites')
               : lang('Eliminat din favorite', 'Removed from favourites'), on ? 'ok' : null);
    });
    /* linkurile care poartă un filtru merg singure, cu tot cu starea căutării */
    $$('[data-filter]').forEach(a => a.onclick = e => {
      e.preventDefault();
      save(); goto(listingHref() + qs() + '&f=' + a.dataset.filter);
    });
    $$('.offer-card, .camp .btn, .link-more').forEach(c => {
      if (c.hasAttribute('data-filter')) return;
      if (c.closest('.sec-head') || c.classList.contains('offer-card') || c.closest('.camp')) {
        c.onclick = e => {
          if (c.tagName === 'A' && /toate facilitățile/i.test(c.textContent)) return;
          e.preventDefault(); save(); goto(listingHref() + qs());
        };
      }
    });
    $$('.vp-card .btn, .loyal-band .btn, .friends-band').forEach(b => b.onclick = e => {
      e.stopPropagation();
      openModal('Program FRIENDS', '<p>Înscrierea este gratuită și beneficiile încep de la prima rezervare.</p>' +
        '<p><b>Friend</b> — 2% credite din valoarea fiecărui sejur.<br><b>Good Friend</b> — 3% credite, de la 3 check-in-uri pe an.<br><b>Best Friend</b> — 5% credite.</p>' +
        '<p>1 credit = 1 Leu reducere. Creditele sunt valabile 5 ani și acoperă până la 10% din valoarea unei rezervări viitoare.</p>');
    });

    /* footer + legal links */
    $$('.footer a, .legal a').forEach(a => {
      if (a.getAttribute('href') === '#') a.onclick = e => { e.preventDefault(); toast('În prototip: ' + a.textContent.trim()); };
    });

    /* logo → home */
    const logo = $('.logo'); if (logo) { logo.style.cursor = 'pointer'; logo.onclick = () => goto(en('home-c.html') + qs()); }

    /* breadcrumbs */
    $$('.crumbs a').forEach((a, i) => a.onclick = e => { e.preventDefault(); goto(i === 0 ? en('home-c.html') + qs() : listingHref() + qs()); });

    /* --- variant B: see-also tabs, pager, newsletter, theme tiles --- */
    const tabs = $$('.seealso .tab');
    if (tabs.length) {
      const SETS = {
        0: RESORTS.map(r => ['Cazare ' + r[0], r[1] + '']),
        1: [['Înscrieri Timpurii 2026', '263'], ['Oferte Last Minute', '159'], ['Oferta Verii', '123'], ['Oferta Speciala', '89'],
            ['Oferta Sfânta Maria', '59'], ['Litoralul Pentru Toți', '55'], ['Oferta Nibiru', '48'], ['Zile Gratuite de Vacanță', '30'],
            ['Oferta Extrasezon', '25'], ['Extra Discount', '8'], ['Oferta cu tratament', '6'], ['Oferta Seniori', '5'],
            ['Mare pentru cei mici', '2'], ['Festival Beach Please', '1']],
        2: [['Hoteluri all inclusive', '112'], ['Direct pe plajă', '126'], ['Cu piscină', '384'], ['Pentru familii cu copii', '441'],
            ['Doar pentru adulți', '18'], ['Cu bază de tratament', '36'], ['Wellness & SPA', '97'], ['Cu animale acceptate', '214'],
            ['Cu parcare gratuită', '1 021'], ['Self check-in', '12']]
      };
      const cols = $('.seealso .cols');
      const paintTab = i => {
        cols.innerHTML = SETS[i].map(([t, c]) => '<a href="#">' + t + ' <span class="c">· ' + c + '</span></a>').join('');
        $$('a', cols).forEach(a => a.onclick = e => { e.preventDefault(); save(); goto(listingHref() + qs()); });
      };
      tabs.forEach((t, i) => t.onclick = () => { tabs.forEach(x => x.classList.remove('on')); t.classList.add('on'); paintTab(i); });
    }
    $$('.pager a:not([data-p])').forEach(a => a.onclick = e => {
      e.preventDefault();
      if (a.classList.contains('on')) return;
      $$('.pager a').forEach(x => x.classList.remove('on'));
      if (!/›/.test(a.textContent)) a.classList.add('on');
      window.scrollTo({ top: ($('.listing-grid') || document.body).offsetTop - 90, behavior: 'smooth' });
      toast(lang('Pagina ', 'Page ') + a.textContent.trim() + lang(' — în prototip lista rămâne aceeași', ' — the list stays the same in this prototype'));
    });
    $$('.theme').forEach(t => t.onclick = () => { save(); goto(listingHref() + qs()); });
    const nlBtn = $('.nl .btn');
    if (nlBtn) nlBtn.onclick = () => {
      const box = $('.nl .form');
      box.innerHTML = '<div class="trust-note" style="color:#9BE8C2;font-size:15px"><svg width="16" height="16"><use href="#i-check-g"/></svg> Gata! Ți-am trimis un e-mail de confirmare.</div>';
      toast('Te-ai abonat la ofertele de pe litoral', 'ok');
    };
    const nlIn = $('.nl .inp');
    if (nlIn) { nlIn.contentEditable = 'true'; nlIn.onfocus = () => { if (!nlIn.dataset.t) { nlIn.textContent = ''; nlIn.dataset.t = '1'; nlIn.style.color = '#1E1E1E'; } }; }
    const howLink = $('.resbar .how');
    if (howLink) howLink.onclick = () => openModal('Cum stabilim ordinea ofertelor', 
      '<p>Ordinea implicită („Recomandate de noi”) combină: disponibilitatea reală în inventarul nostru pentru datele alese, ' +
      'nota din recenziile clienților noștri, raportul preț–calitate față de restul stațiunii și dacă hotelul are confirmare instantă.</p>' +
      '<p>Hotelurile nu pot plăti pentru o poziție mai bună în listă. Ofertele marcate „Doar la noi” sunt contractate exclusiv de agenția noastră.</p>' +
      '<p>Poți schimba oricând criteriul din meniul de sortare: preț, notă sau distanță față de plajă.</p>');
    /* Aici stătea bara „Prototip interactiv" — scoasă: acoperea colțul din stânga jos,
       adică exact comenzile de prototip. Ce se poate face pe ecran se vede din panou. */
  }

  /* ============================================================
     CONȚINUT DE LA TURIȘTI — încărcarea de fotografii, clipuri și recenzii
     Dovada vizuală pe care hotelul nu o poate retușa; în plus, e singurul
     conținut nou care intră gratuit pe pagina hotelului după sejur.
     ============================================================ */
  const UP_FILES = [
    { n: 'IMG_4127.jpg', s: '3,2 MB', src: 'assets/pool-sunset.jpg', pos: '20% 70%' },
    { n: 'IMG_4131.jpg', s: '2,8 MB', src: 'assets/coastline.jpg', pos: '70% 40%' },
    { n: 'VID_0042.mp4', s: '18,4 MB', src: 'assets/aerial-portrait.jpg', pos: '50% 25%', vid: '0:24' }
  ];
  const PLAY_ICON = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';

  function upFilesHtml() {
    return UP_FILES.map((f, i) => '<div class="up-file" data-f="' + i + '">' +
      '<span class="th"><img src="' + f.src + '" style="object-position:' + f.pos + '" alt="">' +
      (f.vid ? '<i>' + PLAY_ICON + '</i>' : '') + '</span>' +
      '<div><div class="n">' + f.n + '</div><div class="s">' + f.s + (f.vid ? ' · ' + f.vid : '') + '</div></div>' +
      '<span class="rm">✕</span></div>').join('');
  }

  /* Consimțământul rămâne nebifat și blochează butonul — aceeași regulă ca la checkout. */
  function gateOnConsent(m, onSend) {
    const cb = $('.consent .cb', m), btn = $('[data-send]', m);
    if (!cb || !btn) return;
    btn.classList.add('btn-disabled');
    cb.onclick = () => {
      cb.classList.toggle('on'); cb.classList.remove('err');
      btn.classList.toggle('btn-disabled', !cb.classList.contains('on'));
    };
    btn.onclick = () => {
      if (btn.classList.contains('btn-disabled')) { cb.classList.add('err'); return; }
      onSend();
    };
  }

  /* editabilele din formularele-mockup: placeholder care dispare la focus */
  function mockInputs(m) {
    $$('.inp', m).forEach(i => {
      i.contentEditable = 'true';
      i.onfocus = () => { if (i.classList.contains('ph')) { i.textContent = ''; i.classList.remove('ph'); } };
    });
  }

  function wireFileList(m) {
    $$('.up-file .rm', m).forEach(x => x.onclick = () => {
      x.closest('.up-file').remove();
      const left = $$('.up-file', m).length;
      const head = $('.up-head', m);
      if (head) head.textContent = lang('Pregătite de trimis (', 'Ready to send (') + left + ')';
      if (!left) { const l = $('.up-list', m); if (l) l.remove(); }
    });
  }

  function ugcUploadModal() {
    const m = openModal(lang('Adaugă fotografii și clipuri', 'Add photos and videos'),
      '<p>' + lang(
        'Fotografiile turiștilor sunt cea mai citită parte a paginii. Poți încărca <b>până la 10 fotografii</b> și <b>2 clipuri de maximum 60 de secunde</b>. Le verificăm înainte de publicare și nu le retușăm.',
        'Guest photos are the most-read part of the page. You can upload <b>up to 10 photos</b> and <b>2 clips of up to 60 seconds</b>. We check them before publishing and never retouch them.') + '</p>' +
      '<div class="up-drop"><span class="ic"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M12 16V4M8 8l4-4 4 4M4 16v3.5h16V16"/></svg></span>' +
      '<b>' + lang('Trage fișierele aici', 'Drag your files here') + '</b>' +
      '<span>' + lang('sau <a href="#">alege de pe calculator</a>', 'or <a href="#">pick them from your computer</a>') + '</span>' +
      '<span class="hint">JPG, PNG, HEIC, MP4 · ' + lang('max. 20 MB pentru o fotografie, 200 MB pentru un clip', 'max 20 MB per photo, 200 MB per clip') + '</span></div>' +
      '<div class="up-list"><div class="up-head">' + lang('Pregătite de trimis (3)', 'Ready to send (3)') + '</div>' + upFilesHtml() + '</div>' +
      '<div class="fld" style="margin-top:14px"><label>' + lang('Descriere (opțional)', 'Caption (optional)') + '</label>' +
      '<div class="inp ph">' + lang('Ex: priveliștea de la etajul 4, dimineața', 'e.g. the view from the 4th floor, in the morning') + '</div></div>' +
      '<div class="consent"><span class="cb"></span><span>' + lang(
        'Confirm că sunt fotografiile/clipurile mele, că nu apar în ele alte persoane fără acordul lor și că pot fi publicate pe litoralulromanesc.ro.',
        'I confirm these are my own photos/clips, that no one else appears in them without their consent, and that they may be published on litoralulromanesc.ro.') + '</span></div>' +
      '<div class="up-perk"><b>+20 ' + lang('credite FRIENDS', 'FRIENDS credits') + '</b> ' + lang(
        'pentru primul set de fotografii publicat după un sejur. 1 credit = 1 Leu.',
        'for the first set of photos published after a stay. 1 credit = 1 Leu.') + '</div>' +
      '<button class="btn btn-primary" style="width:100%;padding:13px 0;margin-top:12px" data-send>' +
      lang('Trimite spre verificare', 'Send for review') + '</button>');
    wireFileList(m);
    mockInputs(m);
    gateOnConsent(m, () => {
      closeModal();
      toast(lang('Am primit fișierele. Le publicăm după verificare, în cel mult 24 de ore.',
        'Got your files. We publish them after a check, within 24 hours.'), 'ok');
    });
  }

  function reviewModal() {
    let stars = 0;
    const m = openModal(lang('Scrie o recenzie', 'Write a review'),
      '<p>' + lang(
        'Recenziile apar doar de la clienți care au stat prin noi, așa că le legăm de rezervare. Nota generală o publicăm pe 10, la fel ca notele hotelurilor.',
        'Reviews only come from guests who booked through us, so we tie them to a booking. The overall score is published out of 10, like every hotel score.') + '</p>' +
      '<div class="rv-stay"><img src="assets/room-seaview.jpg" alt=""><div><div class="t">Complex Mediteranean</div>' +
      '<div class="d">' + lang('Sejur 5–12 iunie 2026 · Cameră dublă vedere mare', 'Stay 5–12 June 2026 · Double room, sea view') + '</div></div></div>' +
      '<div class="fld"><label>' + lang('Nota generală', 'Overall score') + '</label>' +
      '<div class="rv-stars">' + [1, 2, 3, 4, 5].map(i => '<span data-s="' + i + '">★</span>').join('') +
      '<b class="rv-out"></b></div></div>' +
      '<div class="fld"><label>' + lang('Ce ți-a plăcut', 'What you liked') + '</label>' +
      '<div class="inp ph area">' + lang('Ex: șezlongurile incluse și micul dejun', 'e.g. the included sunbeds and the breakfast') + '</div></div>' +
      '<div class="fld"><label>' + lang('Ce s-ar putea îmbunătăți (opțional)', 'What could be better (optional)') + '</label>' +
      '<div class="inp ph area">' + lang('Ex: liftul are coadă la prânz', 'e.g. there is a queue for the lift at lunchtime') + '</div></div>' +
      '<button class="btn btn-outline-navy rv-add" style="width:100%;padding:11px 0">' +
      lang('Adaugă fotografii sau clipuri la recenzie', 'Attach photos or clips to the review') + '</button>' +
      '<div class="rv-files" hidden><div class="up-list"><div class="up-head">' +
      lang('Atașate recenziei (3)', 'Attached to the review (3)') + '</div>' + upFilesHtml() + '</div></div>' +
      '<div class="consent" style="margin-top:14px"><span class="cb"></span><span>' + lang(
        'Recenzia mea poate fi publicată cu prenumele și orașul meu. Am citit <a href="#">regulile de publicare</a>.',
        'My review may be published with my first name and city. I have read the <a href="#">publishing rules</a>.') + '</span></div>' +
      '<button class="btn btn-primary" style="width:100%;padding:13px 0;margin-top:10px" data-send>' +
      lang('Trimite recenzia', 'Send the review') + '</button>');
    $$('.rv-stars span', m).forEach(s => s.onclick = () => {
      stars = +s.dataset.s;
      $$('.rv-stars span', m).forEach(x => x.classList.toggle('on', +x.dataset.s <= stars));
      $('.rv-out', m).textContent = (stars * 2).toFixed(1).replace('.', EN() ? '.' : ',') + ' / 10';
    });
    mockInputs(m);
    wireFileList(m);
    /* atașarea se face în formular, nu într-o altă fereastră — altfel se pierde textul scris */
    $('.rv-add', m).onclick = () => {
      const box = $('.rv-files', m);
      box.hidden = false;
      $('.rv-add', m).textContent = lang('3 fișiere atașate', '3 files attached');
      $('.rv-add', m).classList.add('btn-disabled');
    };
    gateOnConsent(m, () => {
      if (!stars) { toast(lang('Alege întâi nota generală', 'Pick the overall score first')); return; }
      closeModal();
      toast(lang('Mulțumim! Publicăm recenzia după verificare, în cel mult 24 de ore.',
        'Thank you! We publish the review after a check, within 24 hours.'), 'ok');
    });
  }

  /* ============================================================
     INVENTAR PROPRIU — marcarea și promovarea hotelurilor charterate
     ============================================================ */
  const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
    '<path d="M12 3l7 2.6v5.6c0 4.5-3 8-7 9.8-4-1.8-7-5.3-7-9.8V5.6z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>';
  const lang = (ro, en) => EN() ? en : ro;
  const ownLabel = () => lang('Garantat de noi', 'Guaranteed by us');
  const ownBadge = (cls) => '<span class="own-badge' + (cls ? ' ' + cls : '') + '">' + SHIELD + ownLabel() + '</span>';

  function ownModal() {
    openModal(ownLabel(), EN()
      ? '<p>Hotels marked this way are <b>contracted directly by our agency</b>. We hold our own allotment of rooms there, which changes three things for you:</p>' +
        '<p><b>The availability you see is real</b> — it is our stock, not a live query to the hotel.<br>' +
        '<b>The booking is confirmed instantly</b>, without waiting for the hotel to reply.<br>' +
        '<b>Our consultants can change or cancel it</b> without depending on the hotel’s answer.</p>' +
        '<p>The rest of the stays are booked on request, with confirmation within a few hours.</p>'
      : '<p>Hotelurile marcate astfel sunt <b>contractate direct de agenția noastră</b>. Avem alocare proprie de camere acolo, ceea ce schimbă trei lucruri pentru tine:</p>' +
        '<p><b>Disponibilitatea afișată este reală</b> — este stocul nostru, nu o interogare live la hotel.<br>' +
        '<b>Rezervarea se confirmă instantaneu</b>, fără să așteptăm răspunsul hotelului.<br>' +
        '<b>Consultanții noștri o pot modifica sau anula</b> fără să depindă de răspunsul hotelului.</p>' +
        '<p>Restul cazărilor se rezervă la cerere, cu confirmare în câteva ore.</p>');
  }

  /* Autentificarea e o promisiune comercială (credite, rezervări la un loc),
     nu doar un formular — de aceea o explicăm oriunde o cerem. */
  function loginModal(register) {
    const m = openModal(register ? lang('Creează cont', 'Create an account') : lang('Autentifică-te', 'Sign in'),
      (lang('<p>Autentifică-te ca să ai rezervările, voucherele și facturile într-un singur loc, să plătești restul online și să primești <b>2% credite FRIENDS</b> la fiecare sejur.</p><div class="fld" style="margin-top:14px"><label>E-mail</label><div class="inp ph">ana@exemplu.ro</div></div><div class="fld"><label>Parolă</label><div class="inp ph">••••••••</div></div><p style="font-size:12.5px">Ai uitat parola? <a href="#">Îți trimitem un link de resetare</a></p>', '<p>Sign in to keep your bookings, vouchers and invoices in one place, pay the balance online, and earn <b>2% FRIENDS credits</b> on every stay.</p><div class="fld" style="margin-top:14px"><label>E-mail</label><div class="inp ph">ana@example.com</div></div><div class="fld"><label>Password</label><div class="inp ph">••••••••</div></div><p style="font-size:12.5px">Forgot your password? <a href="#">We will send you a reset link</a></p>')) +
      '<button class="btn btn-primary" style="width:100%;padding:13px 0;margin-top:6px" data-do>' +
      (register ? lang('Creează cont', 'Create account') : lang('Autentifică-te', 'Sign in')) + '</button>' +
      '<p style="text-align:center;margin-top:10px;font-size:13px">' +
      (register ? lang('Ai deja cont? ', 'Already have an account? ') : lang('Nu ai cont? ', 'No account yet? ')) +
      '<a href="#" data-swap><b>' + (register ? lang('Autentifică-te', 'Sign in') : lang('Creează cont', 'Create one')) + '</b></a></p>');
    $$('.inp', m).forEach(i => { i.contentEditable = 'true';
      i.onfocus = () => { if (i.classList.contains('ph')) { i.textContent = ''; i.classList.remove('ph'); } }; });
    $('[data-swap]', m).onclick = e => { e.preventDefault(); loginModal(!register); };
    $('[data-do]', m).onclick = () => {
      closeModal(); applyAuth('in');
      try { localStorage.setItem('litroAuth', 'in'); } catch (e) { }
      $$('.pt-auth .pt-b').forEach(b => b.classList.toggle('on', b.dataset.auth === 'in'));
      toast(lang('Ești autentificat — bannerele pentru membri au dispărut', 'You are signed in — the member banners are gone'), 'ok');
    };
  }
  function initLogin() {
    $$('[data-login]').forEach(b => b.onclick = e => { e.stopPropagation(); loginModal(false); });
    $$('[data-register]').forEach(b => b.onclick = e => { e.stopPropagation(); loginModal(true); });
  }

  function initOwnInventory() {
    $$('.lcard[data-own="1"]').forEach(c => {
      const tags = $('.lc-tags', c) || $('.lc-mid', c);
      if (tags && !$('.own-badge', c)) tags.insertAdjacentHTML('afterbegin', ownBadge());
    });
    $$('.hcard[data-own="1"]').forEach(c => {
      const body = $('.hcard-body', c);
      if (body && !$('.own-badge', c)) body.insertAdjacentHTML('afterbegin', '<div style="margin-bottom:7px">' + ownBadge() + '</div>');
    });
    if (document.body.dataset.own === '1') {
      const line = $('.hp-title');
      if (line && !$('.own-badge', line.parentElement)) line.insertAdjacentHTML('afterend', '<div style="margin-top:8px">' + ownBadge() + '</div>');
    }
    $$('.own-badge').forEach(b => b.onclick = e => { e.stopPropagation(); e.preventDefault(); ownModal(); });
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initProtoTools();
    initPinnedTile();
    initSearch();
    initFlexiStrip();
    initListing();
    initHotel();
    initCheckout();
    initThanks();
    initGeneric();
    initOwnInventory();
    initLogin();
    repriceEverything();
    /* titlul hotelului și o parte din carduri se scriu abia acum, iar ele decid
       din ce hotel vin pozele de producție — deci repictăm la finalul boot-ului */
    if (window.LITRO_ASSETS) LITRO_ASSETS.repaint();
  });
})();
