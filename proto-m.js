/* ============================================================
   LITRO mobile web prototype — interaction engine
   Aceeași stare și același model de preț ca proto.js (desktop):
   cheia localStorage „litro" este comună, deci poți trece de pe
   desktop pe mobil fără să pierzi destinația / datele / oaspeții.
   Tot ce e specific mobilului (sheet-uri, bara de rezervare fixă,
   filtrele pe ecran complet) trăiește aici, nu în proto.js.

   Limba: paginile EN au <html lang="en">; t(ro, en) alege textul,
   iar navigarea merge automat la variantele „-en".
   ============================================================ */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const PAGE = () => document.body.dataset.page;
  const EN = () => document.documentElement.lang === 'en';
  const t = (ro, en) => EN() ? en : ro;
  const enp = n => EN() ? n.replace('.html', '-en.html') : n;

  const FILE = (location.pathname.split('/').pop() || 'm-home.html');
  const RO_FILE = FILE.replace('-en.html', '.html');
  const D_MAP = { 'm-home.html': 'home-c.html', 'm-listing.html': 'listing-c.html', 'm-hotel.html': 'hotel.html', 'm-checkout.html': 'checkout.html', 'm-thankyou.html': 'thankyou.html' };

  const MON_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const MONL_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mon = i => EN() ? MON_EN[i] : MON_RO[i];
  const monL = i => EN() ? MONL_EN[i] : MONL_RO[i];
  const DOW = () => EN() ? ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'] : ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

  const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const pad = n => (n < 10 ? '0' : '') + n;
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const TODAY = new Date(2026, 4, 20);         // „azi" în prototip — sejurul demo din iunie rămâne rezervabil
  const parse = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const nightsBetween = (a, b) => Math.max(1, Math.round((parse(b) - parse(a)) / 864e5));
  const fmtShort = s => { const d = parse(s); return d.getDate() + ' ' + mon(d.getMonth()); };
  const fmtRange = (a, b) => fmtShort(a) + ' – ' + fmtShort(b);
  /* pluralul românesc are trei forme la unele cuvinte, dar pentru cazurile de aici
     e destul „1 = singular, restul = plural"; engleza folosește aceeași regulă. */
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const nightsTxt = n => plural(n, t('noapte', 'night'), t('nopți', 'nights'));
  const roomsTxt = () => plural(S.rooms, t('cameră', 'room'), t('camere', 'rooms'));
  const staysTxt = n => plural(n, t('cazare disponibilă', 'available stay'), t('cazări disponibile', 'available stays'));

  const RESORTS = [
    ['Mamaia', 319], ['Mamaia Nord', 58], ['Eforie Nord', 184], ['Eforie Sud', 76], ['Costinești', 97],
    ['Neptun-Olimp', 112], ['Jupiter', 64], ['Venus', 71], ['Saturn', 49], ['Mangalia', 38],
    ['Constanța', 84], ['Vama Veche 2 Mai', 64], ['Techirghiol', 21], ['Năvodari', 18], ['Tuzla', 9],
    ['Corbu', 12], ['23 August', 14], ['Piatra', 7], ['Ovidiu', 5]
  ];

  /* ---------- stare (partajată cu prototipul desktop) ---------- */
  const DEF = {
    dest: 'Mamaia', from: '2026-06-05', to: '2026-06-12',
    adults: 2, kids: 2, ages: [7, 11], rooms: 2,
    hotel: 'Complex Mediteranean', rate: 'Cameră dublă vedere mare', ratePrice: 4046,
    payMode: 'advance', voucher: 0, promo: null, flex: 'Date exacte'
  };
  let S = Object.assign({}, DEF);
  try { S = Object.assign(S, JSON.parse(localStorage.getItem('litro') || '{}')); } catch (e) { }
  const qp = new URLSearchParams(location.search);
  ['dest', 'from', 'to', 'hotel', 'rate'].forEach(k => { if (qp.get(k)) S[k] = qp.get(k); });
  ['adults', 'kids', 'rooms', 'ratePrice'].forEach(k => { if (qp.get(k)) S[k] = +qp.get(k); });
  const save = () => { try { localStorage.setItem('litro', JSON.stringify(S)); } catch (e) { } };
  const nights = () => nightsBetween(S.from, S.to);
  const guestsTxt = () => plural(S.adults, t('adult', 'adult'), t('adulți', 'adults')) +
    (S.kids ? ' + ' + plural(S.kids, t('copil', 'child'), t('copii', 'children')) : '');

  /* ---------- model de preț (identic cu desktopul) ---------- */
  function dayFactor(d) {
    const m = d.getMonth(), day = d.getDate(), dow = d.getDay();
    let f = 1;
    if (m === 5) f = day < 15 ? 0.86 : 0.95;
    else if (m === 6) f = 1.12;
    else if (m === 7) f = day < 20 ? 1.18 : 1.05;
    else if (m === 8) f = day < 12 ? 0.9 : 0.72;
    else f = 0.7;
    if (dow === 5 || dow === 6) f *= 1.06;
    f *= 1 + (((day * 7919) % 13) - 6) / 100;
    return f;
  }
  const ppnFor = (base, dateStr) => Math.round(base * dayFactor(parse(dateStr)) / 5) * 5;
  function stayTotal(base, from, to) {
    let tot = 0, d = parse(from);
    const end = parse(to);
    while (d < end) { tot += ppnFor(base, iso(d)); d = addDays(d, 1); }
    return tot;
  }

  /* ---------- navigare ---------- */
  const spin = el('div', 'spin'); document.body.appendChild(spin);
  const qs = () => '?dest=' + encodeURIComponent(S.dest) + '&from=' + S.from + '&to=' + S.to +
    '&adults=' + S.adults + '&kids=' + S.kids + '&rooms=' + S.rooms;
  function goto(url, delay) {
    spin.classList.add('on');
    setTimeout(() => { location.href = enp(url) + qs(); }, delay == null ? 400 : delay);
  }

  /* ---------- toast ---------- */
  const toastWrap = el('div', 'toast-wrap'); document.body.appendChild(toastWrap);
  function toast(msg, kind) {
    const n = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    toastWrap.appendChild(n);
    setTimeout(() => { n.style.transition = 'opacity .25s'; n.style.opacity = '0'; setTimeout(() => n.remove(), 260); }, 2500);
  }

  /* ---------- sheet-uri (stivuibile) ---------- */
  const ov = el('div', 'ov'); document.body.appendChild(ov);
  const stack = [];
  function syncOverlay() {
    ov.classList.toggle('open', stack.length > 0);
    document.body.classList.toggle('noscroll', stack.length > 0);
  }
  function openSheet(opt) {
    const sh = el('div', 'sheet' + (opt.full ? ' full' : ''));
    sh.innerHTML =
      (opt.full ? '' : '<div class="sh-grip"></div>') +
      '<div class="sh-head">' + (opt.back ? '<button class="x back" aria-label="' + t('Înapoi', 'Back') + '"><svg width="22" height="22"><use href="#i-chev-l"/></svg></button>' : '') +
      '<h3></h3>' + (opt.clear ? '<button class="clear">' + opt.clear + '</button>' : '') +
      '<button class="x close" aria-label="' + t('Închide', 'Close') + '"><svg width="20" height="20"><use href="#i-x"/></svg></button></div>' +
      '<div class="sh-body"></div>' +
      (opt.foot ? '<div class="sh-foot">' + opt.foot + '</div>' : '');
    $('h3', sh).textContent = opt.title || '';
    $('.sh-body', sh).innerHTML = opt.body || '';
    document.body.appendChild(sh);
    stack.push(sh);
    syncOverlay();
    requestAnimationFrame(() => sh.classList.add('open'));
    $('.close', sh).onclick = () => closeSheet();
    const back = $('.sh-head .back', sh);
    if (back) back.onclick = () => closeSheet();
    if (opt.onOpen) opt.onOpen(sh);
    return sh;
  }
  function closeSheet(all) {
    const sh = stack.pop();
    if (sh) { sh.classList.remove('open'); setTimeout(() => sh.remove(), 300); }
    if (all) while (stack.length) { const s = stack.pop(); s.classList.remove('open'); setTimeout(() => s.remove(), 300); }
    syncOverlay();
  }

  /* ---------- modal (informații, galerie) ---------- */
  const mwrap = el('div', 'modal-wrap'); mwrap.innerHTML = '<div class="modal"></div>'; document.body.appendChild(mwrap);
  const modal = $('.modal', mwrap);
  function openModal(title, html) {
    modal.innerHTML = '<div class="modal-head"><h3></h3><button class="x"><svg width="20" height="20"><use href="#i-x"/></svg></button></div><div class="modal-body"></div>';
    $('h3', modal).textContent = title;
    $('.modal-body', modal).innerHTML = html;
    mwrap.classList.add('open'); ov.classList.add('open'); document.body.classList.add('noscroll');
    $('.x', modal).onclick = closeModal;
    return modal;
  }
  function closeModal() {
    mwrap.classList.remove('open');
    if (!stack.length) { ov.classList.remove('open'); document.body.classList.remove('noscroll'); }
  }
  ov.onclick = () => { if (mwrap.classList.contains('open')) closeModal(); else closeSheet(); };

  /* ============================================================
     PAINT — orice depinde de destinație / date / oaspeți
     ============================================================ */
  function paint() {
    $$('[data-bind="dest"]').forEach(n => n.textContent = S.dest || t('Alege stațiunea', 'Pick a resort'));
    $$('[data-bind="dates"]').forEach(n => n.textContent = fmtRange(S.from, S.to));
    $$('[data-bind="nights"]').forEach(n => n.textContent = nights());
    $$('[data-bind="guests"]').forEach(n => n.textContent = guestsTxt());
    $$('[data-bind="rooms"]').forEach(n => n.textContent = roomsTxt());
    $$('[data-bind="stay"]').forEach(n => n.textContent = fmtRange(S.from, S.to) + ' · ' + nightsTxt(nights()));
    /* rezumatul din bara de sus trebuie să încapă pe un rând — persoane, nu „adulți + copii" */
    $$('[data-bind="sum"]').forEach(n => n.textContent =
      fmtRange(S.from, S.to) + ' · ' + (S.adults + S.kids) + t(' pers.', ' guests') + ' · ' + roomsTxt());
    $$('[data-bind="hotel"]').forEach(n => n.textContent = S.hotel);
  }

  function repriceEverything() {
    const n = nights();
    paint();

    /* carduri de listing */
    $$('.lcard[data-ppn]').forEach(card => {
      const base = +card.dataset.ppn;
      const total = stayTotal(base, S.from, S.to);
      const disc = +(card.dataset.disc || 0);
      const gross = disc ? Math.round(total / (1 - disc / 100)) : 0;
      const p = $('.price', card); if (p) p.innerHTML = money(total) + ' <span class="cur">Lei</span>';
      const op = $('.old-price', card); if (op) op.textContent = gross ? money(gross) + ' Lei' : '';
      const note = $('.price-note', card);
      if (note) {
        const mealRo = card.dataset.meal || 'mic dejun';
        const mealEn = { 'mic dejun': 'breakfast', 'demipensiune': 'half board', 'all inclusive': 'all inclusive', 'pensiune completă': 'full board' }[mealRo] || mealRo;
        note.innerHTML = EN()
          ? S.adults + ' adults, ' + nightsTxt(n) + ' with ' + mealEn + '<br>VAT included · resort tax at the hotel'
          : S.adults + ' adulți, ' + nightsTxt(n) + ' cu ' + mealRo + '<br>TVA inclus · taxa de stațiune la hotel';
      }
      const cr = $('.credits', card); if (cr) cr.textContent = '+ ' + Math.round(total * 0.02) + t(' credite FRIENDS', ' FRIENDS credits');
      const sv = $('.save', card);
      if (sv) { if (gross > total) { sv.style.display = ''; sv.textContent = t('economisești ', 'you save ') + money(gross - total) + ' Lei'; } else sv.style.display = 'none'; }
      card.dataset.total = total;
    });

    /* rândul de iconițe pentru modul „rezumat" (C) — date · masă · cameră */
    $$('.lcard').forEach(card => {
      const box = $('.lc-icons', card);
      if (!box) return;
      /* doar textele se rescriu — iconițele SVG rămân pe loc */
      const d = $('.li-date', box), m = $('.li-meal', box);
      if (d) { $('.t', d).textContent = t('din ', 'from ') + fmtShort(S.from); $('.s', d).textContent = nightsTxt(n); }
      if (m) {
        const mealRo = card.dataset.meal || 'mic dejun';
        $('.t', m).textContent = EN()
          ? ({ 'mic dejun': 'Breakfast', 'demipensiune': 'Half board', 'all inclusive': 'All inclusive' }[mealRo] || mealRo)
          : mealRo.charAt(0).toUpperCase() + mealRo.slice(1);
      }
    });

    /* tarife de hotel */
    $$('.rate[data-ppn]').forEach(r => {
      const total = stayTotal(+r.dataset.ppn, S.from, S.to);
      const p = $('.price', r); if (p) p.innerHTML = money(total) + ' <span class="cur">Lei</span>';
      const op = $('.old-price', r); if (op) op.textContent = money(Math.round(total / 0.85)) + ' Lei';
      const nn = $('.rnights', r); if (nn) nn.textContent = nightsTxt(n) + ' · ' + roomsTxt();
      r.dataset.total = total;
    });

    /* bara de preț „de la" de pe pagina hotelului */
    const pb = $('.pricebar [data-from-price]');
    if (pb) {
      const cheapest = $$('.rate[data-ppn]:not(.rate-request)').map(r => +r.dataset.total).filter(Boolean);
      if (cheapest.length) pb.innerHTML = money(Math.min.apply(null, cheapest)) + ' <span class="cur">Lei</span>';
    }

    const strip = $('.flexi');
    if (strip && strip._render) strip._render();
    if (PAGE() === 'checkout') paintCheckout();
  }

  /* ============================================================
     CĂUTARE — sheet-uri: destinație, calendar, oaspeți
     ============================================================ */
  function destSheet(after) {
    const sh = openSheet({
      title: t('Unde mergi?', 'Where to?'), full: true, back: true,
      body: '<input class="dest-search" placeholder="' + t('Caută stațiune sau hotel…', 'Search a resort or hotel…') + '" autocomplete="off">' +
        '<div class="grp">' + t('Stațiuni pe litoral', 'Seaside resorts') + '</div><div class="dlist"></div>'
    });
    const list = $('.dlist', sh), inp = $('.dest-search', sh);
    function render(f) {
      f = (f || '').toLowerCase();
      const rows = RESORTS.filter(r => !f || r[0].toLowerCase().includes(f));
      list.innerHTML = rows.length
        ? rows.map(r => '<div class="dest-item' + (r[0] === S.dest ? ' sel' : '') + '" data-d="' + r[0] + '">' +
          '<svg width="17" height="17" class="ic"><use href="#i-pin"/></svg>' + r[0] + '<span class="c">' + r[1] + t(' cazări', ' stays') + '</span></div>').join('')
        : '<div class="dest-item">' + t('Nicio stațiune găsită', 'No resort found') + '</div>';
      $$('[data-d]', list).forEach(it => it.onclick = () => {
        S.dest = it.dataset.d; save(); paint(); closeSheet();
        if (after) after();
      });
    }
    inp.oninput = () => render(inp.value);
    render('');
  }

  const CAL_FLEX = () => EN()
    ? ['Exact dates', '± 1 day', '± 3 days', 'A weekend', 'A week']
    : ['Date exacte', '± 1 zi', '± 3 zile', 'Un weekend', 'O săptămână'];
  function calSheet(after) {
    const flexList = CAL_FLEX();
    let pick = { from: S.from, to: S.to, half: false, flex: flexList.indexOf(S.flex) >= 0 ? S.flex : flexList[0] };
    const sh = openSheet({
      title: t('Când călătorești?', 'When are you travelling?'), full: true, back: true,
      foot: '<button class="btn btn-primary btn-block" data-ok></button>',
      body: '<div class="fx-chips"></div><div class="months"></div>'
    });
    const months = $('.months', sh), chips = $('.fx-chips', sh), ok = $('[data-ok]', sh);

    function mk(base) {
      const y = base.getFullYear(), m = base.getMonth();
      const startIdx = (new Date(y, m, 1).getDay() + 6) % 7;
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
        cells += '<div class="' + cl + '" data-d="' + ds + '">' + d + (past ? '' : '<span class="p">' + ppn + '</span>') + '</div>';
      }
      return '<div class="cal-m"><div class="mname">' + monL(m) + ' ' + y + '</div><div class="cal-grid">' +
        DOW().map(x => '<div class="dow">' + x + '</div>').join('') + cells + '</div></div>';
    }
    function render() {
      chips.innerHTML = flexList.map(f => '<button class="fx-chip' + (pick.flex === f ? ' on' : '') + '" data-flex="' + f + '">' + f + '</button>').join('');
      let html = '';
      for (let i = 0; i < 5; i++) html += mk(new Date(2026, 4 + i, 1));
      months.innerHTML = html;
      const n = pick.from && pick.to ? nightsBetween(pick.from, pick.to) : 0;
      ok.textContent = n
        ? t('Aplică · ', 'Apply · ') + fmtRange(pick.from, pick.to) + ' (' + nightsTxt(n) + ')'
        : t('Alege data de plecare', 'Pick the check-out date');
      ok.classList.toggle('btn-disabled', !n);
      ok.classList.toggle('btn-primary', !!n);

      $$('.fx-chip', chips).forEach(c => c.onclick = () => {
        pick.flex = c.dataset.flex; S.flex = pick.flex; save();
        if (/weekend/i.test(pick.flex)) { let d = parse(pick.from || S.from); while (d.getDay() !== 5) d = addDays(d, 1); pick.from = iso(d); pick.to = iso(addDays(d, 2)); pick.half = false; }
        else if (/săptămână|week$/i.test(pick.flex)) { pick.from = '2026-06-05'; pick.to = '2026-06-12'; pick.half = false; }
        render();
      });
      $$('.cal-d[data-d]:not(.past)', months).forEach(c => c.onclick = () => {
        const ds = c.dataset.d;
        if (!pick.half) { pick.from = ds; pick.to = null; pick.half = true; }
        else if (ds <= pick.from) { pick.from = ds; pick.to = null; }
        else { pick.to = ds; pick.half = false; }
        render();
      });
    }
    ok.onclick = () => {
      if (!pick.to) return toast(t('Alege și data de plecare', 'Pick the check-out date too'), 'err');
      S.from = pick.from; S.to = pick.to; save();
      closeSheet(); repriceEverything();
      toast(t('Datele actualizate: ', 'Dates updated: ') + fmtRange(S.from, S.to), 'ok');
      if (after) after();
    };
    render();
    setTimeout(() => { const st = $('.cal-d.start', months); if (st) st.scrollIntoView({ block: 'center' }); }, 60);
  }

  function guestsSheet(after) {
    const sh = openSheet({
      title: t('Oaspeți și camere', 'Guests and rooms'), back: true,
      foot: '<button class="btn btn-primary btn-block" data-ok>' + t('Gata', 'Done') + '</button>',
      body: '<div class="glist"></div>'
    });
    const list = $('.glist', sh);
    function row(label, sub, key, min, max) {
      return '<div class="g-row"><div><div class="l">' + label + '</div><div class="s">' + sub + '</div></div>' +
        '<div class="stepper"><button class="b' + (S[key] <= min ? ' off' : '') + '" data-step="' + key + '" data-dir="-1">−</button>' +
        '<span class="v">' + S[key] + '</span>' +
        '<button class="b' + (S[key] >= max ? ' off' : '') + '" data-step="' + key + '" data-dir="1">+</button></div></div>';
    }
    function render() {
      list.innerHTML =
        row(t('Adulți', 'Adults'), t('de la 18 ani', 'from 18 years'), 'adults', 1, 10) +
        row(t('Copii', 'Children'), t('0–17 ani', '0–17 years'), 'kids', 0, 4) +
        (S.kids ? '<div class="ages">' + Array.from({ length: S.kids }).map((_, i) =>
          '<span class="age">' + t('Copil ', 'Child ') + (i + 1) + ': <select data-age="' + i + '">' +
          Array.from({ length: 18 }).map((__, a) => '<option' + ((S.ages[i] || 7) === a ? ' selected' : '') + '>' + a + '</option>').join('') +
          '</select> ' + t('ani', 'yrs') + '</span>').join('') + '</div>' : '') +
        row(t('Camere', 'Rooms'), t('repartizare la recepție', 'assigned at reception'), 'rooms', 1, 5) +
        '<p style="color:var(--gray-700);font-size:12.5px;margin-top:12px">' +
        t('Vârsta copiilor decide prețul și accesul la ofertele pentru familii (praguri 0–9,99 și 0–13,99 ani).',
          'Children’s ages drive the price and eligibility for family offers (age bands 0–9.99 and 0–13.99).') + '</p>';
      $$('[data-step]', list).forEach(b => b.onclick = () => {
        if (b.classList.contains('off')) return;
        const k = b.dataset.step;
        S[k] = Math.max(0, S[k] + (+b.dataset.dir));
        if (k === 'kids') S.ages = Array.from({ length: S.kids }).map((_, i) => S.ages[i] != null ? S.ages[i] : 7);
        save(); render(); paint();
      });
      $$('[data-age]', list).forEach(s => s.onchange = () => { S.ages[+s.dataset.age] = +s.value; save(); });
    }
    render();
    $('[data-ok]', sh).onclick = () => { closeSheet(); repriceEverything(); if (after) after(); };
  }

  /* sheet-ul principal „Modifică căutarea" — folosit de bara de rezumat de sus */
  function searchSheet(opt) {
    opt = opt || {};
    const sh = openSheet({
      title: opt.title || t('Modifică căutarea', 'Edit your search'),
      foot: '<button class="btn btn-primary btn-block" data-go><span>' + t('Caută', 'Search') + '</span> <svg width="19" height="19"><use href="#i-search"/></svg></button>',
      body:
        '<button class="sfield" data-f="dest"><span class="ic"><svg width="21" height="21"><use href="#i-pin"/></svg></span>' +
        '<span><span class="lbl">' + t('Unde mergi?', 'Where to?') + '</span><br><span class="val" data-bind="dest"></span></span></button>' +
        '<button class="sfield" data-f="date"><span class="ic"><svg width="21" height="21"><use href="#i-cal"/></svg></span>' +
        '<span><span class="lbl">' + t('Când călătorești?', 'When are you travelling?') + '</span><br><span class="val" data-bind="dates"></span></span></button>' +
        '<button class="sfield" data-f="guests"><span class="ic"><svg width="21" height="21"><use href="#i-users"/></svg></span>' +
        '<span><span class="lbl">' + t('Oaspeți și camere', 'Guests and rooms') + '</span><br><span class="val"><span data-bind="guests"></span>, <span data-bind="rooms"></span></span></span></button>' +
        '<p class="trust-note" style="margin-top:14px"><svg width="15" height="15"><use href="#i-check-g"/></svg> ' +
        t('Inventar propriu · confirmare instantanee', 'Own inventory · instant confirmation') + '</p>'
    });
    paint();
    $('[data-f="dest"]', sh).onclick = () => destSheet(paint);
    $('[data-f="date"]', sh).onclick = () => calSheet(paint);
    $('[data-f="guests"]', sh).onclick = () => guestsSheet(paint);
    $('[data-go]', sh).onclick = () => {
      if (!S.dest) return toast(t('Alege mai întâi o stațiune', 'Pick a resort first'), 'err');
      save(); closeSheet(true);
      if (opt.onSearch) opt.onSearch(); else goto('m-listing.html');
    };
  }

  /* ============================================================
     ANTET — burger, telefon, rezumatul căutării
     ============================================================ */
  function initHeader() {
    const NAV = EN()
      ? [['Romanian Seaside', 'm-home.html'], ['Danube Delta', null], ['Seaside deals', null], ['Resorts', null],
      ['All-inclusive hotels', null], ['Last minute', null], ['Seaside for Everyone', null],
      ['FRIENDS programme', null], ['Pay in instalments', null], ['Holiday vouchers', null], ['Contact', null]]
      : [['Litoral România', 'm-home.html'], ['Delta Dunării', null], ['Oferte litoral', null], ['Stațiuni', null],
      ['Hoteluri all inclusive', null], ['Last minute', null], ['Litoralul Pentru Toți', null],
      ['Program FRIENDS', null], ['Vacanțe în rate', null], ['Vouchere de vacanță', null], ['Contact', null]];
    const burger = $('.m-head .burger');
    if (burger) burger.onclick = () => {
      openModal(t('Meniu', 'Menu'), '<div class="menu-list">' +
        NAV.map(([n, h]) => '<a href="' + (h ? enp(h) : '#') + '">' + n + '</a>').join('') + '</div>' +
        '<div style="margin-top:14px;display:flex;gap:8px"><a class="btn btn-outline-navy btn-sm" href="#">' + t('Contul meu', 'My account') + '</a>' +
        '<a class="btn btn-outline-navy btn-sm" href="tel:0241999">' + t('Sună 0241 999', 'Call 0241 999') + '</a></div>');
      $$('.menu-list a', modal).forEach(a => { if (a.getAttribute('href') === '#') a.onclick = e => { e.preventDefault(); closeModal(); toast(t('În prototip: ', 'In the prototype: ') + a.textContent); }; });
    };
    const phone = $('.m-head .act-phone');
    if (phone) phone.onclick = () => openModal(t('Sună-ne', 'Call us'),
      t('<p>Consultanții noștri din Constanța verifică tot inventarul propriu și pot rezerva în locul tău.</p>',
        '<p>Our consultants in Constanța check the whole of our own inventory and can book for you.</p>') +
      '<p style="margin-top:10px"><span class="phone-big">0241 999</span><br><b>0241 837 777</b><br>' + t('zilnic 10:00 – 18:00', 'daily 10:00 – 18:00') + '</p>' +
      t('<p style="margin-top:12px">Doar la telefon: plata în rate, cardul de vacanță, voucherele cadou, anulările și asigurarea storno.</p>',
        '<p style="margin-top:12px">Phone only: instalments, holiday cards, gift vouchers, cancellations and trip-cancellation insurance.</p>') +
      '<div style="display:flex;gap:8px;margin-top:14px"><a class="btn btn-primary btn-block" href="tel:0241999">' + t('Sună acum', 'Call now') + '</a></div>');

    const sum = $('.sumcard');
    if (sum) sum.onclick = () => searchSheet({ onSearch: PAGE() === 'listing' ? rerunSearch : null });

    $$('.m-head .back').forEach(b => b.onclick = () => history.length > 1 ? history.back() : goto('m-home.html'));
  }

  /* ============================================================
     PANOU DE PROTOTIP (plutitor) — limbă, vedere, cont, densitate, inventar
     Sunt comutatoare de demo, nu UI de produs: de aceea stau într-un
     panou plutitor, nu în pagină.
     ============================================================ */
  let onInventory = null;   // callback setat de listing
  function initProtoTools() {
    /* ?nopanel=1 — modul de export în Figma: fără panoul de demo, iar barele fixe
       intră în fluxul paginii (altfel ar cădea la mijlocul ramei, unde e marginea
       de jos a ferestrei în momentul capturii). */
    if (qp.get('nopanel')) { document.body.dataset.export = '1'; return; }
    if (!document.body.dataset.auth) { let a; try { a = localStorage.getItem('litroAuth'); } catch (e) { } document.body.dataset.auth = a || 'out'; }
    if (!document.body.dataset.density) {
      let d; try { d = localStorage.getItem('litroDensity'); } catch (e) { }
      document.body.dataset.density = d || 'a';
    }
    const isListing = PAGE() === 'listing';
    const roFile = RO_FILE, enFile = roFile.replace('.html', '-en.html');
    const dFile = D_MAP[roFile] || 'home-c.html';
    const desktopHref = EN() ? dFile.replace('.html', '-en.html') : dFile;

    const seg = (cls, items) => '<div class="pt-seg ' + cls + '">' + items + '</div>';
    const btn = (attr, label, on) => '<span class="pt-b' + (on ? ' on' : '') + '" ' + attr + '>' + label + '</span>';
    const lnk = (href, label, on) => '<a class="pt-b' + (on ? ' on' : '') + '" href="' + href + '">' + label + '</a>';

    const box = el('div', 'proto-tools' + ($('.bookbar, .pricebar') ? ' up' : ''));
    let html = '<div class="pt-h">' + t('Prototip · setări', 'Prototype · settings') + '</div>';
    html += '<div class="pt-row"><span class="pt-lbl">' + t('Limbă', 'Language') + '</span>' +
      seg('pt-lang', lnk(roFile, 'RO', !EN()) + lnk(enFile, 'EN', EN())) + '</div>';
    html += '<div class="pt-row"><span class="pt-lbl">' + t('Vedere', 'View') + '</span>' +
      seg('pt-view', btn('data-view="m"', t('Mobil', 'Mobile'), true) + lnk(desktopHref, 'Desktop', false)) + '</div>';
    html += '<div class="pt-row"><span class="pt-lbl">' + t('Cont', 'Account') + '</span>' +
      seg('pt-auth', [['out', t('Musafir', 'Guest')], ['in', t('Membru', 'Member')]]
        .map(([k, l]) => btn('data-auth="' + k + '"', l, document.body.dataset.auth === k)).join('')) + '</div>';
    if (isListing) {
      html += '<div class="pt-row"><span class="pt-lbl">' + t('Densitate celule', 'Card view') + '</span>' +
        seg('pt-den', [['a', t('Detaliat', 'Detailed')], ['b', t('Compact', 'Compact')], ['c', t('Rezumat', 'Summary')]]
          .map(([k, l]) => btn('data-d="' + k + '" title="' + l + '"', k.toUpperCase(), document.body.dataset.density === k)).join('')) + '</div>';
      html += '<div class="pt-row"><span class="pt-lbl">' + t('Inventar demo', 'Demo inventory') + '</span>' +
        seg('pt-inv', [['99', '81', t('Mult', 'Many')], ['4', '4', t('Mediu', 'Some')], ['2', '2', t('Puțin', 'Few')]]
          .map(([cap, cnt, l], i) => btn('data-cap="' + cap + '" data-count="' + cnt + '"', l, i === 0)).join('')) + '</div>';
    }
    html += '<span class="pt-min" aria-label="' + t('Restrânge', 'Collapse') + '">–</span>';
    box.innerHTML = html;
    document.body.appendChild(box);

    $$('.pt-auth .pt-b', box).forEach(b => b.onclick = () => {
      document.body.dataset.auth = b.dataset.auth;
      try { localStorage.setItem('litroAuth', b.dataset.auth); } catch (e) { }
      $$('.pt-auth .pt-b', box).forEach(x => x.classList.toggle('on', x === b));
    });
    $$('.pt-den .pt-b', box).forEach(b => b.onclick = () => {
      document.body.dataset.density = b.dataset.d;
      try { localStorage.setItem('litroDensity', b.dataset.d); } catch (e) { }
      $$('.pt-den .pt-b', box).forEach(x => x.classList.toggle('on', x === b));
    });
    $$('.pt-inv .pt-b', box).forEach(b => b.onclick = () => {
      $$('.pt-inv .pt-b', box).forEach(x => x.classList.toggle('on', x === b));
      if (onInventory) onInventory(+b.dataset.cap, +b.dataset.count, b.textContent.trim());
    });
    $('.pt-min', box).onclick = () => box.classList.toggle('mini');
    /* linkurile de limbă/vedere duc mai departe starea curentă */
    $$('a.pt-b', box).forEach(a => a.href = a.getAttribute('href') + qs());
  }

  /* ============================================================
     CARUSEL GENERIC (home tiles)
     ============================================================ */
  function initCarousels() {
    $$('[data-carousel]').forEach(root => {
      const track = $('.hc-track', root), dots = $('.hc-dots', root);
      if (!track) return;
      const tiles = $$('.hc-tile', track);
      if (dots) dots.innerHTML = tiles.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('');
      const sync = () => {
        const i = Math.round(track.scrollLeft / (track.scrollWidth / tiles.length));
        if (dots) $$('i', dots).forEach((d, di) => d.classList.toggle('on', di === Math.min(i, tiles.length - 1)));
      };
      track.addEventListener('scroll', sync, { passive: true });
      if (!navigator.webdriver) {
        setInterval(() => {
          if (stack.length || mwrap.classList.contains('open')) return;
          const w = track.scrollWidth / tiles.length;
          if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 8) track.scrollTo({ left: 0, behavior: 'smooth' });
          else track.scrollBy({ left: w, behavior: 'smooth' });
        }, 5200);
      }
    });
  }

  /* ============================================================
     HOME
     ============================================================ */
  function initHome() {
    if (PAGE() !== 'home') return;
    $$('.sbox .sfield').forEach(f => f.onclick = () => {
      const k = f.dataset.f;
      if (k === 'dest') destSheet(paint); else if (k === 'date') calSheet(paint); else guestsSheet(paint);
    });
    const go = $('.sbox .btn');
    if (go) go.onclick = () => { if (!S.dest) return toast(t('Alege mai întâi o stațiune', 'Pick a resort first'), 'err'); save(); goto('m-listing.html'); };

    $$('.insp-card, .mz, .prev-card, .resort-index a').forEach(c => c.onclick = e => {
      e.preventDefault();
      const cap = $('.cap, .t', c);
      const txt = (cap ? cap.textContent : c.textContent).trim();
      const match = RESORTS.find(r => txt.startsWith(r[0]));
      if (match) S.dest = match[0];
      save(); goto('m-listing.html');
    });
    $$('.hcard').forEach(c => c.onclick = () => {
      const h = $('.hname', c); if (h) S.hotel = h.childNodes[0].textContent.trim();
      save(); goto('m-hotel.html');
    });
  }

  /* ============================================================
     LISTING
     ============================================================ */
  const FILTERS = () => EN() ? [
    { g: 'Popular filters', items: [['instant', 'Instant confirmation', 129], ['beach', 'Max. 100 m from the beach', 158], ['pool', 'With a pool', 109], ['breakfast', 'Breakfast included', 108], ['friends', 'Lower FRIENDS price', 200]] },
    { g: 'Distance to the beach', items: [['d100', 'Right on the beach (0–100 m)', 158], ['d300', 'Up to 300 m', 241], ['d600', 'Up to 600 m', 302]] },
    { g: 'Board', items: [['mBreak', 'Breakfast', 108], ['mHalf', 'Half board', 74], ['mAll', 'All inclusive', 112]] },
    { g: 'Facilities', items: [['spa', 'Wellness & SPA', 97], ['kids', 'Kids’ facilities', 141], ['park', 'Free parking', 210], ['pets', 'Pets allowed', 18]] }
  ] : [
    { g: 'Filtre populare', items: [['instant', 'Confirmare instantanee', 129], ['beach', 'La max. 100 m de plajă', 158], ['pool', 'Cu piscină', 109], ['breakfast', 'Mic dejun inclus', 108], ['friends', 'Preț FRIENDS mai mic', 200]] },
    { g: 'Distanța față de plajă', items: [['d100', 'Direct pe plajă (0–100 m)', 158], ['d300', 'Până în 300 m', 241], ['d600', 'Până în 600 m', 302]] },
    { g: 'Masă', items: [['mBreak', 'Mic dejun', 108], ['mHalf', 'Demipensiune', 74], ['mAll', 'All inclusive', 112]] },
    { g: 'Facilități', items: [['spa', 'Wellness & SPA', 97], ['kids', 'Facilități pentru copii', 141], ['park', 'Parcare gratuită', 210], ['pets', 'Acceptă animale', 18]] }
  ];
  const SORTS = () => EN()
    ? [['rec', 'Recommended by us'], ['price', 'Price, low to high'], ['pricedesc', 'Price, high to low'], ['score', 'Top rated'], ['beach', 'Closest to the beach']]
    : [['rec', 'Recomandate de noi'], ['price', 'Preț crescător'], ['pricedesc', 'Preț descrescător'], ['score', 'Cele mai bine notate'], ['beach', 'Cel mai aproape de plajă']];
  let activeFilters = {}, activeSort = 'rec', demoCap = Infinity, demoCount = null;

  function initListing() {
    if (PAGE() !== 'listing') return;
    const cards = $$('.lcard');
    const main = $('.list');

    /* galerie foto pe fiecare card (săgeți + puncte, swipe pe imagine) */
    const POOL = ['pool-rooftop', 'room-seaview', 'lobby', 'aerial-hotel', 'pool-sunset', 'room-double', 'jacuzzi-view', 'spa-indoor', 'apartment-family', 'coastline'].map(n => 'assets/' + n + '.jpg');
    $$('.lcard .ph').forEach(ph => {
      const img = $('img', ph); if (!img) return;
      const dots = $$('.dots i', ph), count = dots.length || 5;
      const first = img.getAttribute('src');
      const start = Math.max(0, POOL.indexOf(first));
      const gal = [first];
      for (let k = 1; k < count; k++) gal.push(POOL[(start + k) % POOL.length]);
      let idx = 0;
      const show = i => { idx = (i + gal.length) % gal.length; img.src = gal[idx]; dots.forEach((d, di) => d.classList.toggle('on', di === idx)); };
      const nav = d => e => { e.stopPropagation(); show(idx + d); };
      const prev = el('button', 'ph-nav prev', '‹'), next = el('button', 'ph-nav next', '›');
      prev.onclick = nav(-1); next.onclick = nav(1);
      ph.appendChild(prev); ph.appendChild(next);
      let x0 = null;
      ph.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      ph.addEventListener('touchend', e => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
        x0 = null;
      }, { passive: true });
      show(0);
    });

    /* inimioare */
    $$('.heart').forEach(h => h.onclick = e => {
      e.stopPropagation(); h.classList.toggle('on');
      toast(h.classList.contains('on') ? t('Adăugat la favorite', 'Added to favourites') : t('Eliminat din favorite', 'Removed from favourites'), h.classList.contains('on') ? 'ok' : null);
    });

    /* rândul de iconițe folosit în modul „Rezumat" (densitate C) */
    const CAL_SVG = '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 2.8V7M16 2.8V7" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
    const FOOD_SVG = '<svg viewBox="0 0 24 24"><path d="M7 3v7M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 12v9M16.5 3c-1.8 1.5-2.5 4-2.5 6.5 0 1.5 1 2.5 2.5 2.5V21M16.5 3V12" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const BED_SVG = '<svg viewBox="0 0 24 24"><path d="M3 18.5V6M3 14h18v4.5M3 11h18v-1a3 3 0 0 0-3-3H9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6.5" cy="8.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    cards.forEach(card => {
      if ($('.lc-icons', card)) return;
      const body = $('.lc-body', card);
      /* linia cu camera e ultimul .hmeta copil direct al corpului (prima e locația, dar e imbricată în .lc-top) */
      const metas = $$(':scope > .hmeta', body);
      const roomLine = metas[metas.length - 1];
      const roomTxt = (card.dataset.room || (roomLine ? roomLine.textContent.trim() : t('Cameră standard', 'Standard room'))).split(' · ')[0];
      const box = el('div', 'lc-icons');
      box.innerHTML = '<div class="lci li-date">' + CAL_SVG + '<div class="t"></div><div class="s"></div></div>' +
        '<div class="lci li-meal">' + FOOD_SVG + '<div class="t"></div></div>' +
        '<div class="lci">' + BED_SVG + '<div class="t">' + roomTxt + '</div></div>';
      /* iconițele intră înaintea blocului de preț */
      const priceRow = $('.lc-price', body);
      if (priceRow) body.insertBefore(box, priceRow); else body.appendChild(box);
    });

    /* deschidere hotel */
    cards.forEach(c => c.addEventListener('click', e => {
      if (e.target.closest('.heart, .more-rooms, .ph-nav, .rcar, a')) return;
      S.hotel = $('.hname', c).childNodes[0].textContent.trim();
      S.ratePrice = +(c.dataset.total || 4046);
      save(); goto('m-hotel.html');
    }));

    /* expander „toate tipurile de cameră" — carusel de camere (ca varianta C desktop) */
    const ROOM_IMG = ['room-seaview', 'room-double', 'apartment-family', 'jacuzzi-view', 'pool-rooftop', 'lobby', 'spa-indoor'];
    const TYPES = EN() ? [
      ['Economy double room', 'no balcony · 18 m²', -0.18],
      ['Standard double room', '1 double bed · 22 m²', -0.08],
      ['Sea-view double room', '+ 2 sun beds included · 24 m²', 0],
      ['Triple room', '3 adults · 28 m²', 0.22],
      ['Family room', '2 adults + 2 children · 34 m²', 0.34],
      ['Studio 4*', 'private terrace · 40 m²', 0.52],
      ['Apartment 4*', '55 m² · separate living room', 0.78]
    ] : [
      ['Cameră dublă economy', 'fără balcon · 18 m²', -0.18],
      ['Cameră dublă standard', '1 pat dublu · 22 m²', -0.08],
      ['Cameră dublă vedere mare', '+ 2 șezlonguri incluse · 24 m²', 0],
      ['Cameră triplă', '3 adulți · 28 m²', 0.22],
      ['Cameră family', '2 adulți + 2 copii · 34 m²', 0.34],
      ['Studio 4*', 'terasă proprie · 40 m²', 0.52],
      ['Apartament 4*', '55 m² · living separat', 0.78]
    ];
    const ROOM_CNT = [7, 5, 6, 4, 8, 5];
    const moreLabel = n => t('Vezi toate tipurile de cameră ', 'See all room types ') + '<span class="cnt">(' + n + ')</span> ▾';
    cards.forEach((card, i) => {
      const body = $('.lc-body', card);
      if (!body || $('.more-rooms', card)) return;
      const n = Math.max(3, Math.min(ROOM_CNT[i % ROOM_CNT.length], 7));
      const m = el('button', 'more-rooms', moreLabel(n));
      body.appendChild(m);
      const base = +(card.dataset.ppn || 80);
      const boxc = el('div', 'rcar');
      boxc.innerHTML = '<div class="rc-track">' + TYPES.slice(0, n).map(([nm, meta, f], k) => {
        const total = Math.round(stayTotal(base, S.from, S.to) * (1 + f));
        return '<div class="rc-room"><img src="assets/' + ROOM_IMG[k % ROOM_IMG.length] + '.jpg" alt="">' +
          '<div class="rc-b"><div class="rc-name">' + nm + '</div><div class="rc-meta">' + meta + '</div>' +
          '<div class="rc-perk"><svg width="12" height="12"><use href="#i-check-g"/></svg> ' + t('Mic dejun inclus', 'Breakfast included') + '</div>' +
          '<div class="rc-foot"><div class="rc-price">' + money(total) + ' Lei<span class="rc-note">' + nightsTxt(nights()) + '</span></div>' +
          '<button class="btn btn-primary btn-sm rc-sel">' + t('Alege', 'Select') + '</button></div></div></div>';
      }).join('') + '</div>';
      card.appendChild(boxc);
      m.onclick = e => {
        e.stopPropagation();
        boxc.classList.toggle('open');
        m.innerHTML = boxc.classList.contains('open') ? t('Ascunde tipurile de cameră ▴', 'Hide room types ▴') : moreLabel(n);
      };
      $$('.rc-sel', boxc).forEach(b => b.onclick = e => {
        e.stopPropagation();
        S.hotel = $('.hname', card).childNodes[0].textContent.trim(); save(); goto('m-hotel.html');
      });
    });

    /* bara Filtre / Sortare / Hartă */
    const bFil = $('[data-tab="filters"]'), bSort = $('[data-tab="sort"]'), bMap = $('[data-tab="map"]');
    if (bFil) bFil.onclick = filtersSheet;
    if (bSort) bSort.onclick = sortSheet;
    if (bMap) bMap.onclick = () => openModal(t('Hartă · ', 'Map · ') + S.dest,
      '<div class="mapbox" style="height:210px"><img src="assets/coastline.jpg" alt=""><span class="lbl">' +
      t('Hartă interactivă — în prototip statică', 'Interactive map — static in this prototype') + '</span></div>' +
      '<p style="margin-top:12px">' + t('Pe hartă vezi cele <b><span class="mc"></span> cazări</b> din ', 'The map shows the <b><span class="mc"></span> stays</b> in ') + S.dest +
      t(' cu prețul pentru ', ' with the price for ') + fmtRange(S.from, S.to) +
      t(', distanța până la plajă și zonele stațiunii.', ', the distance to the beach and the areas of the resort.') + '</p>');

    function countActive() { return Object.values(activeFilters).filter(Boolean).length; }
    function syncTabs() {
      if (bFil) {
        const n = countActive();
        bFil.innerHTML = '<svg width="17" height="17"><use href="#i-filter"/></svg> ' + t('Filtre', 'Filters') + (n ? ' <span class="n">' + n + '</span>' : '');
      }
      if (bSort) {
        const s = SORTS().find(x => x[0] === activeSort);
        bSort.innerHTML = '<svg width="17" height="17"><use href="#i-sort"/></svg> ' + (activeSort === 'rec' ? t('Sortare', 'Sort') : s[1].split(/[ ,]/)[0]);
      }
      if (bMap) bMap.innerHTML = '<svg width="17" height="17"><use href="#i-map"/></svg> ' + t('Hartă', 'Map');
    }

    function matches(card, f) {
      const fac = (card.dataset.fac || '').split(','), beach = +(card.dataset.beach || 999), meal = (card.dataset.meal || '').toLowerCase();
      if (f.instant && card.dataset.instant !== '1') return false;
      if ((f.beach || f.d100) && beach > 100) return false;
      if (f.d300 && beach > 300) return false;
      if (f.d600 && beach > 600) return false;
      if (f.pool && !fac.includes('pool')) return false;
      if ((f.breakfast || f.mBreak) && !/mic dejun/.test(meal)) return false;
      if (f.mHalf && !/demipensiune/.test(meal)) return false;
      if (f.mAll && !/all inclusive/.test(meal)) return false;
      if (f.friends && card.dataset.friends !== '1') return false;
      if (f.spa && !fac.includes('spa')) return false;
      if (f.kids && !fac.includes('kids')) return false;
      if (f.park && !fac.includes('park')) return false;
      if (f.pets && !fac.includes('pets')) return false;
      return true;
    }

    function applyFilters() {
      const any = countActive() > 0;
      let shown = 0;
      cards.forEach(c => {
        let ok = matches(c, activeFilters);
        if (ok && shown >= demoCap) ok = false;
        c.classList.toggle('card-hidden', !ok);
        if (ok) shown++;
      });
      const displayN = (demoCount != null && !any) ? demoCount : shown;
      const rc = $('.res-strip');
      if (rc) rc.innerHTML = '<b>' + displayN + '</b> ' + staysTxt(displayN).replace(displayN + ' ', '') +
        t(' în ', ' in ') + S.dest + ' · 8.7/10 ' + t('din 11 395 recenzii', 'from 11,395 reviews');
      $$('.mc').forEach(n => n.textContent = displayN);

      const band = $('.band-loyal');
      if (band) {
        const vis = cards.filter(c => !c.classList.contains('card-hidden'));
        if (vis.length > 1) { vis[1].after(band); band.style.display = ''; } else band.style.display = 'none';
      }
      const fx = $('.flexi');
      if (fx) fx.style.display = shown <= 5 ? '' : 'none';
      if (!shown) showEmpty(); else hideEmpty();
      syncChips(); syncTabs();
    }

    let emptyBox = null;
    function showEmpty() {
      if (emptyBox) return;
      emptyBox = el('div', 'rescue');
      emptyBox.innerHTML = '<div class="t">' + t('Niciun rezultat pentru filtrele alese', 'No results for the filters you picked') + '</div>' +
        '<div class="d">' + t('Relaxează filtrele sau lasă-ne consultanții să caute în tot inventarul nostru de pe litoral.',
          'Relax the filters, or let our consultants search the whole of our seaside inventory.') + '</div>' +
        '<div class="cbrow"><button class="btn btn-outline-navy btn-sm" data-clear>' + t('Șterge filtrele', 'Clear filters') + '</button>' +
        '<a class="btn btn-primary btn-sm" href="tel:0241999">' + t('Sună 0241 999', 'Call 0241 999') + '</a></div>';
      main.prepend(emptyBox);
      $('[data-clear]', emptyBox).onclick = clearAll;
    }
    function hideEmpty() { if (emptyBox) { emptyBox.remove(); emptyBox = null; } }
    function clearAll() { activeFilters = {}; applyFilters(); toast(t('Filtre șterse', 'Filters cleared')); }

    function syncChips() {
      const wrap = $('.fchips');
      if (!wrap) return;
      const labels = [];
      FILTERS().forEach(g => g.items.forEach(([k, l]) => { if (activeFilters[k]) labels.push([k, l]); }));
      wrap.innerHTML = labels.map(([k, l]) => '<button class="fchip" data-k="' + k + '">' + l + ' <span class="x">✕</span></button>').join('') +
        (labels.length ? '<button class="clr">' + t('Șterge tot', 'Clear all') + '</button>' : '');
      wrap.style.display = labels.length ? '' : 'none';
      $$('.fchip', wrap).forEach(c => c.onclick = () => { activeFilters[c.dataset.k] = false; applyFilters(); });
      const clr = $('.clr', wrap); if (clr) clr.onclick = clearAll;
    }

    function filtersSheet() {
      const draft = Object.assign({}, activeFilters);
      const sh = openSheet({
        title: t('Filtre', 'Filters'), full: true, clear: t('Șterge tot', 'Clear all'),
        foot: '<button class="btn btn-primary btn-block" data-ok></button>',
        body: FILTERS().map(g => '<div class="fgroup"><div class="fh"><h4>' + g.g + '</h4></div>' +
          g.items.map(([k, l, c]) => '<label class="frow" data-k="' + k + '"><span class="cb' + (draft[k] ? ' on' : '') + '"></span>' + l + '<span class="c">(' + c + ')</span></label>').join('') + '</div>').join('') +
          '<div class="fgroup"><div class="fh"><h4>' + t('Buget pe noapte', 'Budget per night') + '</h4></div>' +
          '<input class="range" type="range" min="100" max="1200" step="50" value="1200">' +
          '<div class="range-lbl"><span>100 Lei</span><span><b class="bmax">1 200</b> Lei</span></div></div>' +
          '<div class="fgroup"><div class="fh"><h4>' + t('Categorie', 'Star rating') + '</h4></div><div class="starbox">' +
          [['5', 129], ['4', 109], ['3', 158], ['≤2', 58]].map(([n, c]) => '<button><span class="n">' + n + ' ★</span><span class="c">(' + c + ')</span></button>').join('') + '</div></div>'
      });
      const ok = $('[data-ok]', sh);
      const count = () => cards.filter(c => matches(c, draft)).length;
      const syncOk = () => {
        const n = count();
        ok.textContent = n ? t('Arată ', 'Show ') + staysTxt(n) : t('Niciun rezultat', 'No results');
        ok.classList.toggle('btn-disabled', !n); ok.classList.toggle('btn-primary', !!n);
      };
      $$('.frow', sh).forEach(r => r.onclick = e => {
        e.preventDefault();
        const k = r.dataset.k;
        draft[k] = !draft[k];
        $('.cb', r).classList.toggle('on', !!draft[k]);
        syncOk();
      });
      $$('.starbox button', sh).forEach(b => b.onclick = () => b.classList.toggle('on'));
      const rng = $('.range', sh), bmax = $('.bmax', sh);
      if (rng) rng.oninput = () => bmax.textContent = money(+rng.value);
      $('.clear', sh).onclick = () => { Object.keys(draft).forEach(k => delete draft[k]); $$('.cb', sh).forEach(c => c.classList.remove('on')); $$('.starbox button', sh).forEach(b => b.classList.remove('on')); syncOk(); };
      ok.onclick = () => { if (ok.classList.contains('btn-disabled')) return; activeFilters = draft; closeSheet(); applyFilters(); };
      syncOk();
    }

    function sortSheet() {
      const opts = SORTS();
      const sh = openSheet({
        title: t('Sortare', 'Sort'),
        body: opts.map(([k, l]) => '<div class="sort-item' + (k === activeSort ? ' on' : '') + '" data-s="' + k + '"><span class="rd"></span>' + l + '</div>').join('') +
          '<button class="link-more" data-how style="margin-top:14px;display:block">' + t('Cum stabilim ordinea? →', 'How do we rank offers? →') + '</button>'
      });
      $$('[data-s]', sh).forEach(it => it.onclick = () => {
        activeSort = it.dataset.s;
        const list = cards.slice().sort((a, b) => {
          if (activeSort === 'price') return (+a.dataset.total || 0) - (+b.dataset.total || 0);
          if (activeSort === 'pricedesc') return (+b.dataset.total || 0) - (+a.dataset.total || 0);
          if (activeSort === 'score') return (+b.dataset.score || 0) - (+a.dataset.score || 0);
          if (activeSort === 'beach') return (+a.dataset.beach || 0) - (+b.dataset.beach || 0);
          return (+a.dataset.rank || 0) - (+b.dataset.rank || 0);
        });
        const anchor = $('.pager', main);
        list.forEach(c => main.insertBefore(c, anchor));
        closeSheet(); applyFilters();
        toast(t('Sortat: ', 'Sorted: ') + opts.find(x => x[0] === activeSort)[1], 'ok');
      });
      $('[data-how]', sh).onclick = () => {
        closeSheet();
        openModal(t('Cum stabilim ordinea ofertelor', 'How we rank offers'),
          t('<p>Ordinea implicită („Recomandate de noi") combină disponibilitatea reală în inventarul nostru pentru datele alese, nota din recenziile clienților, raportul preț–calitate față de restul stațiunii și dacă hotelul are confirmare instantanee.</p><p>Hotelurile nu pot plăti pentru o poziție mai bună în listă.</p><p>Poți schimba oricând criteriul: preț, notă sau distanță față de plajă.</p>',
            '<p>The default order ("Recommended by us") combines real availability in our own inventory for your dates, the review score from our customers, value for money against the rest of the resort, and whether the hotel confirms instantly.</p><p>Hotels cannot pay for a better position in the list.</p><p>You can change the criterion at any time: price, score or distance to the beach.</p>'));
      };
    }

    /* comutatorul de inventar trăiește în panoul de prototip, nu în pagină */
    onInventory = (cap, count, label) => {
      demoCap = cap; demoCount = count;
      activeFilters = {};
      applyFilters();
      toast(t('Inventar demo: ', 'Demo inventory: ') + label, 'ok');
    };
    demoCap = 99; demoCount = 81;

    initCallback();

    $$('.near-card').forEach(c => c.onclick = () => { S.dest = $('.t', c).textContent.trim(); save(); goto('m-listing.html'); });

    $$('.pager a').forEach(a => a.onclick = e => {
      e.preventDefault();
      if (a.classList.contains('on')) return;
      $$('.pager a').forEach(x => x.classList.remove('on'));
      if (!/›/.test(a.textContent)) a.classList.add('on');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast(t('Pagina ', 'Page ') + a.textContent.trim() + t(' — în prototip lista rămâne aceeași', ' — the list stays the same in this prototype'));
    });

    applyFilters();
  }

  function rerunSearch() {
    spin.classList.add('on');
    setTimeout(() => {
      spin.classList.remove('on');
      repriceEverything();
      const rc = $('.res-strip');
      if (rc) rc.innerHTML = rc.innerHTML.replace(EN() ? / in [^·]+ ·/ : / în [^·]+ ·/, t(' în ', ' in ') + S.dest + ' ·');
      toast(t('Rezultate pentru ', 'Results for ') + S.dest + ', ' + fmtRange(S.from, S.to), 'ok');
    }, 520);
  }

  /* formularul „te sunăm noi" din benzile de salvare */
  function initCallback() {
    $$('[data-callback]').forEach(box => {
      const btn = $('.btn', box), inp = $('.inp', box);
      if (!btn || !inp || box.dataset.bound) return;
      box.dataset.bound = '1';
      inp.contentEditable = 'true';
      inp.onfocus = () => { if (inp.classList.contains('ph')) { inp.textContent = ''; inp.classList.remove('ph'); } inp.classList.add('focus'); };
      inp.onblur = () => inp.classList.remove('focus');
      btn.onclick = () => {
        const v = (inp.textContent || '').replace(/\D/g, '');
        if (v.length < 9) { inp.classList.add('err'); return toast(t('Introdu un număr de telefon valid', 'Enter a valid phone number'), 'err'); }
        box.innerHTML = '<div class="t" style="color:var(--green-600)">' + t('Te sunăm în maximum 15 minute', 'We will call you within 15 minutes') + '</div>' +
          '<div class="d">' + t('Un consultant verifică tot inventarul nostru pentru ', 'A consultant checks our whole inventory for ') + fmtRange(S.from, S.to) +
          t(' și te sună la ', ' and calls you on ') + v + '.</div>';
        toast(t('Cererea de apel a fost trimisă', 'Callback request sent'), 'ok');
      };
    });
  }

  /* ============================================================
     BANNER DE DATE FLEXIBILE
     ============================================================ */
  function initFlexi() {
    const strip = $('.flexi');
    if (!strip) return;
    const low = +(strip.dataset.low || 311);
    const cells = $$('.fx-cell', strip);
    function render() {
      const n = nights();
      let cheap = null, cheapVal = Infinity;
      cells.forEach((c, i) => {
        const from = addDays(parse(S.from), -3 + i);
        const to = addDays(from, n);
        c.dataset.from = iso(from); c.dataset.to = iso(to);
        const soldOut = c.dataset.soldout === '1';
        const total = stayTotal(low, iso(from), iso(to));
        c.classList.toggle('sel', iso(from) === S.from);
        c.classList.remove('cheap');
        const d = $('.d', c), p = $('.p', c), s = $('.s', c);
        if (d) d.textContent = from.getDate() + ' – ' + to.getDate() + ' ' + mon(to.getMonth());
        if (soldOut) { c.classList.add('soldout'); if (p) p.textContent = t('Ocupat', 'Sold out'); if (s) s.innerHTML = '&nbsp;'; return; }
        if (p) p.innerHTML = t('de la ', 'from ') + money(total);
        if (s) s.textContent = (c.dataset.hotels || '—') + t(' hoteluri', ' hotels');
        if (total < cheapVal) { cheapVal = total; cheap = c; }
      });
      if (cheap) cheap.classList.add('cheap');
    }
    cells.forEach(c => c.onclick = () => {
      if (c.classList.contains('soldout')) return toast(t('Perioada este ocupată', 'That period is sold out'), 'err');
      S.from = c.dataset.from; S.to = c.dataset.to; save();
      repriceEverything();
      toast(t('Datele schimbate: ', 'Dates changed: ') + fmtRange(S.from, S.to), 'ok');
    });
    strip._render = render;
    render();
  }

  /* ============================================================
     HOTEL
     ============================================================ */
  function initHotel() {
    if (PAGE() !== 'hotel') return;

    const ttl = $('.hp-title');
    if (ttl && S.hotel) ttl.childNodes[0].textContent = S.hotel + ' ';

    /* galerie */
    const track = $('.gal-track');
    if (track) {
      const imgs = $$('img', track);
      const cnt = $('.gal .count');
      const sync = () => {
        const w = track.clientWidth || 1;   // la primul paint lățimea poate fi încă 0
        if (cnt) cnt.textContent = Math.min(imgs.length, Math.round(track.scrollLeft / w) + 1) + ' / ' + imgs.length;
      };
      track.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('load', sync);
      sync();
      imgs.forEach((im, i) => im.onclick = () => lightbox(i, imgs.map(x => x.src)));
    }
    const heart = $('.gal .acts .fav');
    if (heart) heart.onclick = () => { heart.classList.toggle('on'); toast(heart.classList.contains('on') ? t('Adăugat la favorite', 'Added to favourites') : t('Eliminat din favorite', 'Removed from favourites')); };
    const share = $('.gal .acts .share');
    if (share) share.onclick = () => { if (navigator.clipboard) navigator.clipboard.writeText(location.href); toast(t('Link copiat', 'Link copied'), 'ok'); };

    function lightbox(start, all) {
      openModal(t('Galerie foto', 'Photo gallery'),
        '<img class="lb-img" src="' + all[start] + '"><div style="text-align:center;color:var(--gray-600);font-size:12.5px;margin-top:8px" class="lbc"></div>' +
        '<div class="lb-strip">' + all.map((p, i) => '<img src="' + p + '" data-i="' + i + '">').join('') + '</div>');
      let i = start;
      const img = $('.lb-img', modal), c = $('.lbc', modal);
      const p = () => { img.src = all[i]; c.textContent = (i + 1) + ' / ' + all.length; $$('.lb-strip img', modal).forEach((x, xi) => x.classList.toggle('on', xi === i)); };
      $$('.lb-strip img', modal).forEach(x => x.onclick = () => { i = +x.dataset.i; p(); });
      p();
    }

    /* bara de sejur — editare inline */
    $$('.stay-bar .f').forEach(f => f.onclick = () => {
      if (f.dataset.f === 'date') calSheet(); else guestsSheet();
    });

    /* chip-uri de masă */
    $$('.mchip').forEach(ch => ch.onclick = () => {
      $$('.mchip').forEach(c => c.classList.remove('on'));
      ch.classList.add('on');
      const want = (ch.dataset.meal || '').toLowerCase();
      let shown = 0;
      $$('.rate[data-meal]').forEach(r => {
        const ok = !want || (r.dataset.meal || '').toLowerCase().includes(want);
        r.classList.toggle('rate-hidden', !ok);
        if (ok) shown++;
      });
      $$('.room-card').forEach(rc => { rc.style.display = $$('.rate[data-meal]:not(.rate-hidden)', rc).length ? '' : 'none'; });
      toast(shown
        ? shown + t(' tarife cu „', ' rates with “') + ch.textContent.trim() + '”'
        : t('Niciun tarif pentru această opțiune', 'No rate for this option'), shown ? 'ok' : 'err');
    });

    /* selecția camerelor + bara de rezervare care urcă de jos */
    const bar = $('.booking-bar');
    if (bar) {
      const sel = {};
      const rows = $$('.rate[data-ppn]:not(.rate-request)');
      rows.forEach((r, i) => r.dataset.rid = 'r' + i);
      const rowOf = rid => $('.rate[data-rid="' + rid + '"]');
      const info = r => ({
        name: r.closest('.room-card').querySelector('h3').textContent.trim(),
        board: r.dataset.meal || 'mic dejun',
        price: +(r.dataset.total || (+r.dataset.ppn || 578) * 7)
      });
      const totalRooms = () => Object.values(sel).reduce((a, b) => a + b, 0);
      const totalPrice = () => Object.entries(sel).reduce((a, [rid, q]) => a + q * info(rowOf(rid)).price, 0);

      function renderRates() {
        rows.forEach(r => {
          const rid = r.dataset.rid, q = sel[rid] || 0, cell = $('.ract', r);
          r.classList.toggle('sel', q > 0);
          if (!cell) return;
          if (q > 0) {
            cell.innerHTML = '<div class="rate-stepper"><button class="mn">−</button><span class="n">' + q + '</span><button class="pl"' + (q >= 4 ? ' disabled' : '') + '>+</button></div>';
            $('.mn', cell).onclick = () => { sel[rid] = q - 1; if (!sel[rid]) delete sel[rid]; sync(); };
            $('.pl', cell).onclick = () => { if (q < 4) { sel[rid] = q + 1; sync(); } };
          } else {
            cell.innerHTML = '<button class="btn btn-primary btn-sm">' + t('Adaugă cameră', 'Add room') + '</button>';
            $('.btn', cell).onclick = () => { sel[rid] = 1; sync(); toast(t('Cameră adăugată în rezervare', 'Room added to your booking'), 'ok'); };
          }
        });
      }
      function renderBar() {
        const rooms = totalRooms();
        bar.classList.toggle('show', rooms > 0);
        document.body.classList.toggle('has-bar', rooms > 0 || !!$('.pricebar'));
        const shortName = n => n.split(' + ')[0];   // „… + 2 șezlonguri incluse" nu încape pe o linie
        const sm = $('.bb-sum', bar);
        if (sm) sm.innerHTML = rooms
          ? Object.entries(sel).map(([rid, q]) => { const it = info(rowOf(rid)); return '<div class="row"><span class="q">' + q + '×</span> ' + shortName(it.name) + '</div>'; }).join('')
          + '<div class="row">' + nightsTxt(nights()) + ' · ' + fmtRange(S.from, S.to) + '</div>'
          : '';
        const bt = $('.bb-tot .v', bar); if (bt) bt.innerHTML = money(totalPrice()) + ' <span style="font-size:14px">Lei</span>';
        const pbar = $('.pricebar'); if (pbar) pbar.style.display = rooms ? 'none' : '';
      }
      function sync() { renderRates(); renderBar(); }
      renderRates(); renderBar();
      const cta = $('.bb-cta', bar);
      if (cta) cta.onclick = () => {
        if (!totalRooms()) return;
        const first = rowOf(Object.keys(sel)[0]);
        S.rate = info(first).name; S.meal = info(first).board; S.ratePrice = totalPrice(); S.rooms = totalRooms();
        save(); goto('m-checkout.html');
      };
    }

    /* camere „la cerere" — consultant (phone-as-a-scalpel) */
    $$('.btn-request').forEach(b => b.onclick = () => {
      const r = b.closest('.rate');
      const title = (($('.rname', r) || {}).textContent || t('Cameră la cerere', 'On-request room')).trim();
      openModal(t('La cerere · ', 'On request · ') + title,
        '<p>' + t('Această cameră nu se poate rezerva instant online pentru ', 'This room cannot be booked instantly online for ') +
        '<b>' + fmtRange(S.from, S.to) + '</b>. ' +
        t('Un consultant îți verifică disponibilitatea în inventarul nostru propriu.', 'A consultant will check availability in our own inventory.') + '</p>' +
        '<p style="margin-top:10px"><b>' + t('Sună acum:', 'Call now:') + '</b> <span class="phone-big">0241 999</span> · ' + t('zilnic 10:00–18:00', 'daily 10:00–18:00') + '</p>' +
        '<div class="assist" data-callback style="margin-top:12px;display:block"><b>' + t('Sau lasă-ne numărul și te sunăm noi', 'Or leave your number and we will call you') + '</b>' +
        '<div class="d">' + t('Verificăm disponibilitatea și îți trimitem link de plată dacă e liber.', 'We check availability and send you a payment link if it is free.') + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:10px"><span class="inp ph" style="flex:1">' + t('Numărul tău', 'Your number') + '</span>' +
        '<button class="btn btn-primary btn-sm">' + t('Cere apel', 'Request call') + '</button></div></div>');
      initCallback();
    });

    /* CTA din bara de preț — derulează la camere */
    const pb = $('.pricebar .btn');
    if (pb) pb.onclick = () => {
      const target = $('.rooms-anchor') || $('.room-card');
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 110, behavior: 'smooth' });
      toast(t('Alege camera și tariful dorit', 'Choose your room and rate'), 'ok');
    };

    if ($('.pricebar')) document.body.classList.add('has-bar');
  }

  /* ============================================================
     ACORDEOANE (hotel, FAQ, politici)
     ============================================================ */
  function initAccordions() {
    $$('.acc > button').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
  }

  /* ============================================================
     CHECKOUT
     ============================================================ */
  function paintCheckout() {
    const total = S.ratePrice || 4046;
    const tax = Math.round(total / 1.19 * 0.01);
    const discounted = S.promo ? Math.round(total * 0.9) : total;
    const advMin = Math.round(discounted * 0.3);
    let adv = advMin;
    if (S.payMode === 'advance' && S.advance != null) adv = Math.min(discounted, Math.max(advMin, S.advance));
    const gross = Math.round(total / 0.85);

    const lines = $$('.price-lines .pl');
    if (lines[0]) $('.v', lines[0]).textContent = money(gross) + ' Lei';
    if (lines[1]) $('.v', lines[1]).textContent = '−' + money(gross - total) + ' Lei';
    const promoLine = $('.pl.promo');
    if (promoLine) { promoLine.style.display = S.promo ? '' : 'none'; $('.v', promoLine).textContent = '−' + money(total - discounted) + ' Lei'; }
    const tot = $('.pl.total .v'); if (tot) tot.innerHTML = money(discounted) + ' <span style="font-size:14px">Lei</span>';
    const taxV = $('.athotel .pl .v'); if (taxV) taxV.textContent = '≈ ' + tax + ' Lei';
    const cr = $('.co-credits'); if (cr) cr.textContent = '+ ' + Math.round(discounted * 0.02) + t(' credite FRIENDS după sejur', ' FRIENDS credits after your stay');

    const boxes = $$('.pay-box');
    if (boxes[0]) {
      const p = $('.p', boxes[0]);
      if (p) p.innerHTML = '<span class="adv-amt">' + money(adv) + '</span> Lei <span style="font-size:12.5px;font-weight:700;color:var(--gray-700)">' + t('azi', 'today') + '</span>';
      const d = $('.d', boxes[0]);
      if (d) d.innerHTML = t('Restul de <b>', 'The remaining <b>') + money(discounted - adv) + t('</b> Lei — online până la 22 mai sau la hotel.<br>', '</b> Lei — online until 22 May or at the hotel.<br>') +
        t('Minim ', 'Minimum ') + '<span class="adv-min">' + money(advMin) + ' Lei</span> · ' + t('maxim ', 'maximum ') + '<span class="adv-max">' + money(discounted) + ' Lei</span>';
      bindAdv();
    }
    if (boxes[1]) { const p = $('.p', boxes[1]); if (p) p.textContent = money(discounted) + ' Lei'; }
    if (boxes[2]) { const p = $('.p', boxes[2]); if (p) p.innerHTML = '6 × ' + money(Math.round(discounted / 6)) + ' Lei <span style="font-size:12.5px;font-weight:700;color:var(--gray-700)">' + t('0% dobândă', '0% interest') + '</span>'; }

    const bar = $('.pricebar [data-co-total]');
    if (bar) bar.innerHTML = money(S.payMode === 'full' ? discounted : adv) + ' <span class="cur">Lei</span>';
    const barL = $('.pricebar [data-co-label]');
    if (barL) barL.textContent = S.payMode === 'full' ? t('plătești integral azi', 'paid in full today')
      : S.payMode === 'instalments' ? t('în 6 rate fără dobândă', 'in 6 interest-free instalments')
        : t('avans azi · total ', 'advance today · total ') + money(discounted) + ' Lei';

    const v = $('[data-voucher-diff]');
    if (v) { const payNow = S.payMode === 'full' ? discounted : adv; v.innerHTML = '<b>' + money(Math.max(0, payNow - Math.min(S.voucher, payNow))) + ' Lei</b>' + t(' din suma de ', ' of the ') + money(payNow) + ' Lei'; }
  }

  function bindAdv() {
    const a = $('.adv-amt');
    if (!a || a.dataset.bound) return;
    a.dataset.bound = '1';
    a.setAttribute('contenteditable', 'true');
    a.onclick = e => e.stopPropagation();
    a.onfocus = () => {
      if (S.payMode !== 'advance') { S.payMode = 'advance'; save(); $$('.pay-box').forEach((x, i) => x.classList.toggle('on', i === 0)); }
    };
    a.oninput = () => { S.advance = +((a.textContent || '').replace(/\D/g, '') || 0); save(); syncBarOnly(); };
    a.onblur = () => paintCheckout();
  }
  function syncBarOnly() {
    const total = S.ratePrice || 4046;
    const discounted = S.promo ? Math.round(total * 0.9) : total;
    const advMin = Math.round(discounted * 0.3);
    const adv = Math.min(discounted, Math.max(advMin, S.advance == null ? advMin : S.advance));
    const bar = $('.pricebar [data-co-total]');
    if (bar) bar.innerHTML = money(S.payMode === 'full' ? discounted : adv) + ' <span class="cur">Lei</span>';
  }

  function initCheckout() {
    if (PAGE() !== 'checkout') return;
    document.body.classList.add('has-bar');
    paintCheckout();

    $$('.pay-box').forEach((b, i) => b.onclick = e => {
      if (e.target.closest('.assist, .adv-amt')) return;
      $$('.pay-box').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      S.payMode = i === 0 ? 'advance' : i === 1 ? 'full' : 'instalments';
      save(); paintCheckout();
      const cta = $('.pricebar .btn');
      if (cta) cta.textContent = S.payMode === 'instalments' ? t('Trimite cererea', 'Send request') : t('Rezervă', 'Book now');
    });

    $$('.pm-row2').forEach((r, i, arr) => r.onclick = () => {
      arr.forEach(x => $('.cb', x).classList.remove('on'));
      $('.cb', r).classList.add('on');
      if (/vacanț|holiday/i.test(r.textContent)) toast(t('Cardul de vacanță acoperă până la plafonul anual — diferența se plătește cu cardul bancar',
        'The holiday card covers up to the annual cap — the difference is paid by bank card'), 'ok');
    });

    $$('.assist .cb').forEach(cb => cb.onclick = e => {
      e.stopPropagation(); cb.classList.toggle('on');
      const box = cb.closest('.assist');
      if (box.hasAttribute('data-voucher')) { S.voucher = cb.classList.contains('on') ? 800 : 0; save(); paintCheckout(); }
      else if (cb.classList.contains('on')) toast(t('Un consultant te sună pentru linkul de plată în rate', 'A consultant will call you with the instalment payment link'), 'ok');
    });

    const pBtn = $('.promo-row .btn'), pInp = $('.promo-row .inp');
    if (pBtn && pInp) {
      pInp.contentEditable = 'true';
      pInp.onfocus = () => { if (pInp.classList.contains('ph')) { pInp.textContent = ''; pInp.classList.remove('ph'); } pInp.classList.add('focus'); };
      pInp.onblur = () => pInp.classList.remove('focus');
      pBtn.onclick = () => {
        const code = (pInp.textContent || '').trim().toUpperCase();
        if (code === 'LITORAL10') {
          S.promo = code; save(); paintCheckout();
          pBtn.closest('.promo-box').innerHTML = '<div class="trust-note"><svg width="15" height="15"><use href="#i-check-g"/></svg> ' +
            t('Cod ' + code + ' aplicat — reducere 10%', 'Code ' + code + ' applied — 10% off') + '</div>';
          toast(t('Cod promo aplicat: −10%', 'Promo code applied: −10%'), 'ok');
        } else { pInp.classList.add('err'); toast(t('Cod invalid. Încearcă LITORAL10', 'Invalid code. Try LITORAL10'), 'err'); }
      };
    }

    $$('.seg span').forEach((sp, i, arr) => sp.onclick = () => {
      arr.forEach(x => x.classList.remove('on')); sp.classList.add('on');
      const extra = $('[data-company]');
      if (i === 1 && !extra) {
        const row = el('div', 'f2'); row.setAttribute('data-company', '');
        row.innerHTML = '<div class="fld"><label>' + t('Denumire firmă', 'Company name') + '</label><div class="inp ph">S.C. …</div></div>' +
          '<div class="fld"><label>' + t('CUI', 'VAT number') + '</label><div class="inp ph">RO…</div></div>';
        sp.closest('.sect').querySelector('.f2').before(row);
        bindInputs();
      } else if (i === 0 && extra) extra.remove();
    });

    const consents = $$('.consent .cb');
    const cta = $('.pricebar .btn');
    function syncCta() {
      const ok = consents[0] && consents[0].classList.contains('on');
      if (cta) { cta.classList.toggle('btn-disabled', !ok); cta.classList.toggle('btn-primary', ok); }
      const hint = $('.cta-hint'); if (hint) hint.style.visibility = ok ? 'hidden' : 'visible';
    }
    consents.forEach((cb, i) => cb.onclick = () => {
      cb.classList.toggle('on'); cb.classList.remove('err');
      if (i === 1) toast(cb.classList.contains('on') ? t('Te-ai abonat la ofertele noastre', 'You subscribed to our offers') : t('Abonare anulată', 'Subscription cancelled'));
      syncCta();
    });
    syncCta();
    if (cta) cta.onclick = () => {
      if (cta.classList.contains('btn-disabled')) {
        const c = $('.consent .cb'); if (c) { c.classList.add('err'); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        return toast(t('Bifează acceptarea condițiilor pentru a continua', 'Tick the terms to continue'), 'err');
      }
      if (S.promo) { S.ratePrice = Math.round((S.ratePrice || 4046) * 0.9); S.promo = null; }
      save(); goto('m-thankyou.html', 800);
    };

    $$('[data-modify]').forEach(a => a.onclick = e => { e.preventDefault(); goto('m-hotel.html'); });
    bindInputs();
  }

  function bindInputs() {
    $$('.inp').forEach(i => {
      if (i.dataset.bound || i.closest('.promo-row') || i.closest('[data-callback]')) return;
      i.dataset.bound = '1';
      i.contentEditable = 'true';
      i.onfocus = () => { i.classList.add('focus'); if (i.classList.contains('ph')) { i.textContent = ''; i.classList.remove('ph'); } };
      i.onblur = () => i.classList.remove('focus');
    });
  }

  /* ============================================================
     THANK YOU
     ============================================================ */
  function initThanks() {
    if (PAGE() !== 'thankyou') return;
    const total = S.ratePrice || 4046;
    const paid = S.payMode === 'full' ? total : (S.advance != null ? Math.min(total, Math.max(Math.round(total * 0.3), S.advance)) : Math.round(total * 0.3));
    const due = total - paid;
    const cells = $$('.paystate .cell');
    if (cells[0]) { $('.v', cells[0]).textContent = money(paid) + ' Lei'; $('.l', cells[0]).textContent = due ? t('Plătit azi (avans)', 'Paid today (advance)') : t('Plătit azi (integral)', 'Paid today (in full)'); }
    if (cells[1]) { $('.v', cells[1]).textContent = money(due) + ' Lei'; if (!due) cells[1].style.opacity = '.5'; }
    const band = $('.ty-band');
    if (band) band.innerHTML = due
      ? t('<b>Avansul de ' + money(paid) + ' Lei a fost plătit.</b> Restul de ' + money(due) + ' Lei îl poți plăti online până la 22 mai sau direct la hotel, la check-in.',
        '<b>The ' + money(paid) + ' Lei advance has been paid.</b> The remaining ' + money(due) + ' Lei can be paid online until 22 May or at the hotel on check-in.')
      : t('<b>Rezervarea este achitată integral (' + money(paid) + ' Lei).</b> La hotel mai plătești doar taxa de stațiune.',
        '<b>The booking is paid in full (' + money(paid) + ' Lei).</b> At the hotel you only pay the resort tax.');
    const tot = $('.pl.total .v'); if (tot) tot.innerHTML = money(total) + ' <span style="font-size:14px">Lei</span>';
    const cr = $('.ty-credits');
    if (cr) cr.innerHTML = '+' + Math.round(total * 0.02) + t(' credite FRIENDS după sejur · nivel <b>Friend</b> (2%)', ' FRIENDS credits after your stay · <b>Friend</b> tier (2%)');

    const payRest = $('[data-pay-rest]');
    if (payRest) {
      payRest.style.display = due ? '' : 'none';
      payRest.onclick = () => openModal(t('Plătește restul de ', 'Pay the remaining ') + money(due) + ' Lei',
        '<p>' + t('Alege metoda de plată:', 'Choose a payment method:') + '</p><div class="pm-row"><span class="pm hl">' + t('Card online', 'Card online') + '</span><span class="pm">' + t('Transfer bancar', 'Bank transfer') + '</span><span class="pm hl">' + t('Card de vacanță', 'Holiday card') + '</span><span class="pm">' + t('6 rate fără dobândă', '6 interest-free instalments') + '</span></div>' +
        '<p style="margin-top:12px">' + t('După plată primești automat factura și voucherul actualizat pe e-mail.', 'After payment you automatically receive the invoice and the updated voucher by e-mail.') + '</p>');
    }
    $$('.doc .go').forEach(g => g.onclick = () => toast(/curând|soon/i.test(g.textContent) ? t('Factura se emite în 24h', 'The invoice is issued within 24h') : t('În prototip: descărcare document', 'In the prototype: document download'), 'ok'));
  }

  /* ============================================================
     LEGĂTURI GENERICE
     ============================================================ */
  function initGeneric() {
    $$('a[href="#"]').forEach(a => a.onclick = e => { e.preventDefault(); toast(t('În prototip: ', 'In the prototype: ') + a.textContent.trim()); });
    $$('[data-friends]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      openModal(t('Program FRIENDS', 'FRIENDS programme'),
        t('<p>Înscrierea este gratuită și beneficiile încep de la prima rezervare.</p><p><b>Friend</b> — 2% credite din valoarea fiecărui sejur.<br><b>Good Friend</b> — 3% credite, de la 3 check-in-uri pe an.<br><b>Best Friend</b> — 5% credite.</p><p>1 credit = 1 Leu reducere. Creditele sunt valabile 5 ani și acoperă până la 10% din valoarea unei rezervări viitoare.</p>',
          '<p>Joining is free and the benefits start with your first booking.</p><p><b>Friend</b> — 2% credits on every stay.<br><b>Good Friend</b> — 3% credits, from 3 check-ins a year.<br><b>Best Friend</b> — 5% credits.</p><p>1 credit = 1 Leu off. Credits are valid for 5 years and cover up to 10% of a future booking.</p>'));
    });
    const INFO = {
      tax: [t('Taxa de stațiune', 'Resort tax'),
      t('<p>Taxa de stațiune este <b>1% din valoarea cazării fără TVA</b> și se achită <b>la recepția hotelului</b>, nu online.</p><p>Pentru un sejur de 4 000 Lei înseamnă aproximativ 34 Lei. Nu este inclusă în prețul afișat.</p>',
        '<p>The resort tax is <b>1% of the accommodation value excluding VAT</b> and is paid <b>at the hotel reception</b>, not online.</p><p>For a 4,000 Lei stay that is roughly 34 Lei. It is not included in the displayed price.</p>')],
      cancel: [t('Anulare gratuită', 'Free cancellation'),
      t('<p>Poți anula gratuit dacă trimiți solicitarea cu <b>cel puțin 10 zile înainte de check-in</b>.</p><p>Se aplică ofertelor standard, achitate integral. Fiecare solicitare este analizată individual de un consultant.</p><p>După acest termen se reține avansul, iar creditele FRIENDS aferente se anulează.</p>',
        '<p>You can cancel free of charge if you send the request <b>at least 10 days before check-in</b>.</p><p>It applies to standard offers paid in full. Every request is reviewed individually by a consultant.</p><p>After that deadline the advance is retained and the related FRIENDS credits are cancelled.</p>')],
      card: [t('Plata cu card de vacanță', 'Paying with a holiday card'),
      t('<p>Acceptăm carduri de vacanță <b>Edenred, Pluxee și Up România</b> la toate hotelurile de pe site.</p><p>Voucherele au plafon anual, așa că diferența până la valoarea sejurului se achită cu cardul bancar — o calculăm automat la checkout.</p>',
        '<p>We accept <b>Edenred, Pluxee and Up România</b> holiday cards at every hotel on the site.</p><p>The vouchers have an annual cap, so the difference up to the value of the stay is paid by bank card — we calculate it automatically at checkout.</p>')],
      rate: [t('6 rate fără dobândă', '6 interest-free instalments'),
      t('<p>Plătești vacanța în până la <b>6 rate fără dobândă</b> cu BT StarCARD sau 5 rate cu Card Avantaj.</p><p>Plata în rate se finalizează prin consultant: îți trimite linkul de plată după ce confirmi rezervarea.</p>',
        '<p>Pay for your holiday in up to <b>6 interest-free instalments</b> with BT StarCARD, or 5 with Card Avantaj.</p><p>Instalments are completed through a consultant: they send you the payment link once you confirm the booking.</p>')],
      storno: [t('Asigurare storno', 'Trip-cancellation insurance'),
      t('<p>Îți recuperezi banii dacă anulezi din motive medicale, accident, urgență în familie sau pierderea locului de muncă.</p><p><b>Termen:</b> polița trebuie emisă înainte de începerea sejurului și în maximum 3 zile lucrătoare de la rezervare, dacă sejurul începe în mai puțin de 30 de zile.</p>',
        '<p>You get your money back if you cancel for medical reasons, an accident, a family emergency or job loss.</p><p><b>Deadline:</b> the policy must be issued before the stay starts and within 3 working days of booking if the stay begins in less than 30 days.</p>')],
      instant: [t('Inventar propriu · confirmare instantanee', 'Own inventory · instant confirmation'),
      t('<p>Camerele marcate „confirmare instantanee" sunt din <b>alocarea noastră proprie</b> (contract direct cu hotelul), deci rezervarea se confirmă imediat, fără să așteptăm răspunsul hotelului.</p><p>Camerele „la cerere" se verifică de un consultant în maximum câteva ore.</p>',
        '<p>Rooms marked "instant confirmation" come from <b>our own allotment</b> (a direct contract with the hotel), so the booking is confirmed immediately without waiting for the hotel to reply.</p><p>"On request" rooms are checked by a consultant within a few hours at most.</p>')]
    };
    $$('[data-info]').forEach(b => b.onclick = () => {
      const d = INFO[b.dataset.info];
      if (d) openModal(d[0], d[1]);
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initProtoTools();
    initCarousels();
    initHome();
    initFlexi();
    initListing();
    initHotel();
    initAccordions();
    initCheckout();
    initThanks();
    initGeneric();
    repriceEverything();
  });
})();
