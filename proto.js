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
  /* homepage varianta C își trimite fluxul către listing-b (varianta de listing de atelier) */
  const listingHref = () => (document.body.dataset.variant === 'c' ? 'listing-b.html' : 'listing.html');
  const MON = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const MONL = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const DOW = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
  const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const pad = n => (n < 10 ? '0' : '') + n;
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const TODAY = new Date(2026, 4, 20); // prototype 'today' — keeps the June demo stay bookable
  const parse = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const nightsBetween = (a, b) => Math.max(1, Math.round((parse(b) - parse(a)) / 864e5));
  const fmtShort = s => { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()]; };
  const fmtRange = (a, b) => fmtShort(a) + ' – ' + fmtShort(b);

  const RESORTS = [
    ['Mamaia', 319], ['Mamaia Nord', 58], ['Eforie Nord', 184], ['Eforie Sud', 76], ['Costinești', 97],
    ['Neptun-Olimp', 112], ['Jupiter', 64], ['Venus', 71], ['Saturn', 49], ['Mangalia', 38],
    ['Constanța', 84], ['Vama Veche 2 Mai', 64], ['Techirghiol', 21], ['Năvodari', 18], ['Tuzla', 9],
    ['Corbu', 12], ['23 August', 14], ['Piatra', 7], ['Ovidiu', 5]
  ];

  /* ---------- state ---------- */
  const DEF = {
    dest: 'Mamaia', from: '2026-06-05', to: '2026-06-12',
    adults: 2, kids: 2, ages: [7, 11], rooms: 2,
    hotel: 'Complex Mediteranean', rate: 'Cameră dublă vedere mare', ratePrice: 4046,
    payMode: 'advance', voucher: 0, promo: null, flex: 'exact'
  };
  let S = Object.assign({}, DEF);
  try { S = Object.assign(S, JSON.parse(localStorage.getItem('litro') || '{}')); } catch (e) { }
  const q = new URLSearchParams(location.search);
  ['dest', 'from', 'to', 'hotel', 'rate'].forEach(k => { if (q.get(k)) S[k] = q.get(k); });
  ['adults', 'kids', 'rooms', 'ratePrice'].forEach(k => { if (q.get(k)) S[k] = +q.get(k); });
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
  let searchOpenCal = null, searchOpenGuests = null;   // exposed so the hotel stay-bar can open the same editors inline
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
      if (fDest) setVal(fDest, S.dest);
      if (fDate) setVal(fDate, fmtRange(S.from, S.to));
      if (fGuest) {
        const parts = [S.adults + ' ' + (S.adults === 1 ? 'adult' : 'adulți')];
        if (S.kids) parts.push(S.kids + ' ' + (S.kids === 1 ? 'copil' : 'copii'));
        parts.push(S.rooms + ' ' + (S.rooms === 1 ? 'cameră' : 'camere'));
        setVal(fGuest, parts.join(', '));
      }
      $$('[data-bind="dates"]').forEach(n => n.textContent = fmtRange(S.from, S.to));
      $$('[data-bind="nights"]').forEach(n => n.textContent = nights());
      $$('[data-bind="guests"]').forEach(n => {
        n.textContent = S.adults + ' adulți' + (S.kids ? ' + ' + S.kids + ' copii' : '');
      });
      $$('[data-bind="rooms"]').forEach(n => n.textContent = S.rooms + ' ' + (S.rooms === 1 ? 'cameră' : 'camere'));
      $$('[data-bind="dest"]').forEach(n => n.textContent = S.dest);
    }

    /* --- destination popover --- */
    const popD = el('div', 'pop pop-dest');
    popD.innerHTML = '<input class="search-in" placeholder="Caută stațiune sau hotel…"><div class="list"></div>';
    card.appendChild(popD);
    function renderDest(filter) {
      const list = $('.list', popD);
      const f = (filter || '').toLowerCase();
      const rows = RESORTS.filter(r => !f || r[0].toLowerCase().includes(f));
      list.innerHTML = '<div class="grp">Stațiuni pe litoral</div>' + rows.map(r =>
        '<div class="dest-item' + (r[0] === S.dest ? ' sel' : '') + '" data-d="' + r[0] + '">' +
        '<svg width="16" height="16" class="ic"><use href="#i-pin"/></svg>' + r[0] +
        '<span class="c">' + r[1] + ' cazări</span></div>').join('') +
        (rows.length ? '' : '<div class="dest-item">Nicio stațiune găsită</div>');
      $$('.dest-item[data-d]', list).forEach(it => it.onclick = () => {
        S.dest = it.dataset.d; save(); paint(); closeAllPops();
        if (document.body.dataset.page === 'listing') { rerunSearch(); }
      });
    }
    if (fDest) {
      fDest.setAttribute('data-pop-anchor', '');
      fDest.onclick = () => {
        const wasOpen = popD.classList.contains('open');
        closeAllPops(); if (wasOpen) return;
        renderDest(''); placePop(popD, fDest); popD.classList.add('open'); fDest.classList.add('active');
        openPop = popD; const inp = $('.search-in', popD); inp.value = ''; inp.focus();
        inp.oninput = () => renderDest(inp.value);
      };
    }

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
      popG.innerHTML = row('Adulți', 'de la 18 ani', 'adults', 1, 10) +
        row('Copii', '0–17 ani', 'kids', 0, 4) +
        (S.kids ? '<div class="ages">' + Array.from({ length: S.kids }).map((_, i) =>
          '<div class="age">Copil ' + (i + 1) + ': <select data-age="' + i + '">' +
          Array.from({ length: 18 }).map((__, a) => '<option' + ((S.ages[i] || 7) === a ? ' selected' : '') + '>' + a + '</option>').join('') +
          '</select> ani</div>').join('') + '</div>' : '') +
        row('Camere', 'repartizare la recepție', 'rooms', 1, 5) +
        '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-primary" style="padding:10px 20px;font-size:14px" data-g-ok>Gata</button></div>';
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
      if (!S.dest) return toast('Alege mai întâi o stațiune', 'err');
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
        if (p) p.innerHTML = 'de la <b>' + money(total) + '</b> Lei';
        if (s) s.textContent = (c.dataset.hotels || '—') + ' hoteluri';
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
    $$('[data-bind="guests"]').forEach(x => x.textContent = S.adults + ' adulți' + (S.kids ? ' + ' + S.kids + ' copii' : ''));
    $$('[data-bind="rooms"]').forEach(x => x.textContent = S.rooms + ' ' + (S.rooms === 1 ? 'cameră' : 'camere'));
    $$('[data-bind="stayline"]').forEach(x => x.textContent = S.adults + ' adulți, ' + n + ' nopți cu mic dejun');

    // listing cards
    $$('.lcard[data-ppn]').forEach(card => {
      const base = +card.dataset.ppn;
      const total = stayTotal(base, S.from, S.to);
      const disc = +(card.dataset.disc || 0);
      const gross = disc ? Math.round(total / (1 - disc / 100)) : 0;
      const p = $('.price', card);
      if (p) p.innerHTML = money(total) + ' <span class="cur">Lei</span>';
      const op = $('.old-price', card);
      if (op) op.textContent = money(gross) + ' Lei';
      const note = $('.price-note', card);
      if (note) note.innerHTML = S.adults + ' adulți, ' + n + ' nopți cu ' + (card.dataset.meal || 'mic dejun') + '<br>TVA inclus · taxa de stațiune la hotel';
      const cr = $('.credits', card);
      if (cr) cr.textContent = 'Primești ' + Math.round(total * 0.02) + ' credite FRIENDS';
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
        if (cr) cr.textContent = '+ câștigi ' + Math.round(S.ratePrice * 0.02) + ' credite FRIENDS (1 credit = 1 Leu)';
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
  function initHeader() {
    const user = $('.h-user');
    if (user) {
      const m = el('div', 'menu');
      m.innerHTML = '<div class="it">Rezervările mele</div><div class="it">Credite FRIENDS: <b style="margin-left:auto">128</b></div>' +
        '<div class="it">Datele mele</div><div class="sep"></div><div class="it">Ieși din cont</div>';
      document.body.appendChild(m);
      user.setAttribute('data-pop-anchor', '');
      user.onclick = e => {
        e.stopPropagation();
        const was = m.classList.contains('open'); closeAllPops(); if (was) return;
        const r = user.getBoundingClientRect();
        m.style.top = (r.bottom + window.scrollY + 8) + 'px';
        m.style.left = (r.right - 240) + 'px';
        m.classList.add('open'); openPop = m;
      };
      $$('.it', m).forEach(i => i.onclick = () => { closeAllPops(); toast('În prototip: ' + i.textContent.trim()); });
    }
    const burger = $('.h-burger');
    if (burger) burger.onclick = () => openModal('Meniu', [
      ['Litoral România', 'home.html'], ['Cazare Mamaia', 'listing.html'], ['Ofertele noastre', null],
      ['Program FRIENDS', null], ['Vacanțe în rate', null], ['Vouchere de vacanță', null],
      ['Asigurare storno', null], ['Contact', null]
    ].map(([t, href]) => '<p style="font-size:16px"><a href="' + (href || '#') + '" style="font-weight:700">' + t + '</a></p>').join(''));

    $$('.mainnav a').forEach(a => {
      if (a.getAttribute('href') === '#') a.onclick = e => { e.preventDefault(); toast('În prototip: ' + a.textContent.trim()); };
    });
  }

  /* ============================================================
     LISTING
     ============================================================ */
  function initListing() {
    if (document.body.dataset.page !== 'listing') return;
    const cards = $$('.lcard');

    /* --- headline binding --- */
    const h1 = $('.listing-head h1');
    if (h1) h1.textContent = 'Cazare ' + (S.dest || 'litoral');

    /* --- hearts --- */
    $$('.heart').forEach(h => h.onclick = e => {
      e.stopPropagation(); h.classList.toggle('on');
      toast(h.classList.contains('on') ? 'Adăugat la favorite' : 'Eliminat din favorite', h.classList.contains('on') ? 'ok' : null);
    });

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
        goto('hotel.html' + qs());
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
          'Vezi toate tipurile de cameră <span class="cnt">(' + ROOM_CNT[i % ROOM_CNT.length] + ')</span> ↓'));
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
          goto('hotel.html' + qs());
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
          ? 'Ascunde tipurile de cameră ↑'
          : 'Vezi toate tipurile de cameră <span class="cnt">(' + n + ')</span> ↓';
      };
    });

    /* --- filters --- */
    let demoCap = Infinity, demoCount = null;   // comutator demo de inventar (listing B)
    function applyFilters() {
      const active = {
        instant: $('[data-f="instant"]')?.classList.contains('on'),
        beach: $('[data-f="beach"]')?.classList.contains('on'),
        pool: $('[data-f="pool"]')?.classList.contains('on'),
        breakfast: $('[data-f="breakfast"]')?.classList.contains('on'),
        friends: $('[data-f="friends"]')?.classList.contains('on')
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
        if (ok && shown >= demoCap) ok = false;   // demo: plafon de inventar
        c.classList.toggle('card-hidden', !ok);
        if (ok) shown++;
      });
      const displayN = (demoCount != null && !anyFilter) ? demoCount : shown;
      const rc = $('.res-count');
      if (rc) rc.innerHTML = displayN + (displayN === 1 ? ' cazare disponibilă' : ' cazări disponibile') + ' · 8.7/10 din 11 395 recenzii';
      const rcn = $('.res-count-n');
      if (rcn) rcn.textContent = document.body.dataset.variant === 'b' ? money(shown * 206) : shown;
      const band = $('.loyal-band'); if (band) band.style.display = shown > 1 ? '' : 'none';
      // listing B: banner de date flexibile doar când sunt puține rezultate
      const fstrip = $('.flexi-strip');
      if (fstrip && (document.body.dataset.listing === 'b' || document.body.dataset.listing === 'c')) fstrip.style.display = (shown <= 5) ? '' : 'none';
      if (!shown) showEmptyState(); else hideEmptyState();
    }
    let emptyBox = null;
    function showEmptyState() {
      if (emptyBox) return;
      emptyBox = el('div', 'rescue');
      emptyBox.innerHTML = '<span class="ic"><svg width="22" height="22"><use href="#i-phone"/></svg></span>' +
        '<div><div class="t">Niciun rezultat pentru filtrele alese</div>' +
        '<div class="d">Relaxează filtrele sau lasă-ne consultanții să caute în tot inventarul nostru de pe litoral.</div></div>' +
        '<div class="acts"><button class="btn btn-outline-navy" data-clear-all>Șterge filtrele</button>' +
        '<span class="phone">0241 999</span></div>';
      $('.listing-grid main').prepend(emptyBox);
      $('[data-clear-all]', emptyBox).onclick = clearAll;
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
          return (+a.dataset.rank || 0) - (+b.dataset.rank || 0);
        });
        const anchor = $('.show-more', main);
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
    $$('.invdemo [data-cap]').forEach(b => b.onclick = () => {
      $$('.invdemo [data-cap]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      demoCap = +b.dataset.cap; demoCount = +b.dataset.count;
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

    /* --- gallery lightbox --- */
    const photos = $$('.gallery img').map(i => i.src);
    const extra = ['assets/pool-sunset.jpg', 'assets/coastline.jpg', 'assets/lobby.jpg', 'assets/spa-indoor.jpg', 'assets/apartment-family.jpg'].map(p => new URL(p, location.href).href);
    const all = photos.concat(extra);
    let li = 0;
    function lightbox(start) {
      li = start || 0;
      openModal('Galerie foto — ' + (S.hotel || 'Complex Mediteranean'), '<div class="lb-main">' +
        '<img src="' + all[li] + '"><span class="lb-nav prev">‹</span><span class="lb-nav next">›</span>' +
        '<span class="lb-count"></span></div><div class="lb-strip">' +
        all.map((p, i) => '<img src="' + p + '" data-i="' + i + '">').join('') + '</div>', 'lb');
      const img = $('.lb-main img', modal), cnt = $('.lb-count', modal);
      const paint = () => {
        img.src = all[li]; cnt.textContent = (li + 1) + ' / ' + all.length;
        $$('.lb-strip img', modal).forEach((x, i) => x.classList.toggle('on', i === li));
        const on = $('.lb-strip img.on', modal); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
      };
      $('.prev', modal).onclick = () => { li = (li - 1 + all.length) % all.length; paint(); };
      $('.next', modal).onclick = () => { li = (li + 1) % all.length; paint(); };
      $$('.lb-strip img', modal).forEach(x => x.onclick = () => { li = +x.dataset.i; paint(); });
      paint();
    }
    const hero = $('.gallery .hero');
    if (hero) hero.onclick = () => lightbox(0);
    $$('.thumbs .th').forEach((th, i) => th.onclick = () => lightbox(i + 1));
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
            cell.innerHTML = '<button class="btn btn-primary btn-select">Adaugă cameră</button>';
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
          : '<div class="empty">Nicio cameră selectată</div>';
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
        save(); goto('checkout.html' + qs());
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

    /* --- book now --- */
    const bkCta = $('.bk-cta');
    if (bkCta) bkCta.onclick = () => { save(); goto('checkout.html' + qs()); };

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
      stayBar.style.position = 'relative';
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

    /* --- nearby hotels --- */
    $$('.hcard').forEach(c => c.onclick = () => {
      S.hotel = $('.hname', c).childNodes[0].textContent.trim(); save();
      goto('hotel.html' + qs());
    });

    /* --- sticky bar --- */
    const bar = el('div', 'stickybar');
    bar.innerHTML = '<div class="container in"><span class="nm"></span>' +
      '<span class="conf conf-instant"><svg width="12" height="12"><use href="#i-check-g"/></svg> Confirmare instantă</span>' +
      '<div class="sc"><span class="pr"></span><button class="btn btn-primary">Rezervă acum</button></div></div>';
    document.body.appendChild(bar);
    $('.nm', bar).textContent = S.hotel || 'Complex Mediteranean';
    $('.btn', bar).onclick = () => { save(); goto('checkout.html' + qs()); };
    const bkCard = $('.book-card');
    window.addEventListener('scroll', () => {
      if (!bkCard) return;
      const past = window.scrollY > bkCard.offsetTop + bkCard.offsetHeight;
      bar.classList.toggle('on', past);
      $('.pr', bar).textContent = money(S.ratePrice) + ' Lei';
    });
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
    const cr = $('.sum-body .credits'); if (cr) cr.textContent = '+ câștigi ' + Math.round(discounted * 0.02) + ' credite FRIENDS după sejur';

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
    if (rows[1]) rows[1].innerHTML = rows[1].innerHTML.replace(/(<\/span>)[^<]*/, '$1 ' + S.adults + ' adulți + ' + S.kids + ' copii' + (S.kids ? ' (' + S.ages.slice(0, S.kids).join(' și ') + ' ani)' : '') + ' ');
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
    const consents = $$('.consent .cb');
    function syncCta() {
      const ok = consents[0] && consents[0].classList.contains('on');
      if (!cta) return;
      cta.classList.toggle('btn-disabled', !ok);
      cta.classList.toggle('btn-primary', ok);
      const hint = $('.cta-hint');
      if (hint) hint.style.visibility = ok ? 'hidden' : 'visible';
    }
    consents.forEach((cb, i) => cb.onclick = () => {
      cb.classList.toggle('on');
      if (i === 1) toast(cb.classList.contains('on') ? 'Te-ai abonat la ofertele noastre' : 'Abonare anulată');
      syncCta();
    });
    syncCta();
    if (cta) cta.onclick = () => {
      if (cta.classList.contains('btn-disabled')) {
        $('.consent .cb')?.classList.add('err');
        return toast('Bifează acceptarea condițiilor pentru a continua', 'err');
      }
      if (S.promo) { S.ratePrice = Math.round((S.ratePrice || 4046) * 0.9); S.promo = null; }
      save(); goto('thankyou.html' + qs(), 900);
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
      } else goto('hotel.html' + qs());
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
    $$('.insp-card, .mz, .prev-card').forEach(c => c.onclick = () => {
      const cap = $('.cap, .t', c);
      const txt = cap ? cap.textContent.trim() : '';
      const match = RESORTS.find(r => txt.startsWith(r[0]));
      if (match) S.dest = match[0];
      save(); goto(listingHref() + qs());
    });
    $$('.offer-card, .camp .btn, .link-more').forEach(c => {
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
    const logo = $('.logo'); if (logo) { logo.style.cursor = 'pointer'; logo.onclick = () => goto('home.html' + qs()); }

    /* breadcrumbs */
    $$('.crumbs a').forEach((a, i) => a.onclick = e => { e.preventDefault(); goto(i === 0 ? 'home.html' + qs() : listingHref() + qs()); });

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
    $$('.pager a').forEach(a => a.onclick = e => {
      e.preventDefault();
      if (a.classList.contains('on')) return;
      $$('.pager a').forEach(x => x.classList.remove('on'));
      if (!/›/.test(a.textContent)) a.classList.add('on');
      window.scrollTo({ top: $('.listing-grid').offsetTop - 90, behavior: 'smooth' });
      toast('Pagina ' + a.textContent.trim() + ' — în prototip lista rămâne aceeași');
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

    /* hint bar */
    if (!sessionStorage.getItem('litroHint') && !navigator.webdriver) {
      const hint = el('div', 'proto-hint');
      hint.innerHTML = '<span><b>Prototip interactiv.</b> Caută, schimbă datele în calendar, filtrează, deschide galeria, alege o cameră și finalizează rezervarea — totul funcționează.</span><span class="x">✕</span>';
      document.body.appendChild(hint);
      $('.x', hint).onclick = () => { hint.remove(); sessionStorage.setItem('litroHint', '1'); };
      setTimeout(() => { if (hint.isConnected) { hint.style.transition = 'opacity .4s'; hint.style.opacity = '0'; setTimeout(() => hint.remove(), 420); } }, 9000);
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initSearch();
    initFlexiStrip();
    initListing();
    initHotel();
    initCheckout();
    initThanks();
    initGeneric();
    repriceEverything();
  });
})();
