/* ============================================================================
   ASSETS DE PRODUCȚIE
   ----------------------------------------------------------------------------
   Comută toate pozele prototipului pe fotografiile reale de pe
   litoralulromanesc.ro, ca să vedem macheta pe baza de imagini existentă.
   Comutatorul stă în panoul de prototip („Fotografii — Prototip / Producție”),
   se ține minte în localStorage și se poate fixa din URL cu ?assets=prod.

   Cum funcționează: NU rescriem `src`, ci punem `srcset`. Browserul afișează
   candidatul din srcset, iar codul prototipului (galeriile de pe carduri,
   lightbox-ul, categoriile din galeria hotelului — toate citesc și scriu `src`)
   continuă să lucreze cu numele lui de fișier, deci nimic nu se strică.
   Un MutationObserver prinde pozele injectate din JS și schimbările de `src`.

   Ce poză nimerește unde:
     · card de hotel / pagina de hotel → fotografiile ACELUI hotel din producție
       (numele hotelului e citit din card, ex. „Complex Mediteranean”);
     · card de stațiune (banda „în apropiere”, destinații) → poza stațiunii;
     · în rest → setul implicit, ales dintre cele mai bune poze de producție.
   Pachetul și maparea se generează cu tools/build-prod-assets.py.
   ============================================================================ */
(function () {
  'use strict';

  var M = window.LITRO_PROD_MANIFEST;
  var ROOT = 'assets/prod/';
  var KEY = 'litro-assets';
  /* containerele care poartă un nume propriu; căutăm de la poză în sus */
  var NAMED = '.lcard, .hcard, .pick, .hc-hotel, .near-card, .mz, .prev-card, .rv-stay';
  var MAXUP = 6;

  function norm(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  /* cheile lungi primele: „mamaia nord” trebuie testat înaintea lui „mamaia” */
  function byLen(o) { return Object.keys(o || {}).sort(function (a, b) { return b.length - a.length; }); }

  var HOTEL_KEYS = M ? byLen(M.hotelNames) : [];
  var RESORT_KEYS = M ? byLen(M.resortNames) : [];
  /* ?assets= se citește ACUM, la parsarea scriptului: prototipul își rescrie
     adresa din starea căutării (dest/from/to…) înainte de DOMContentLoaded, iar
     parametrul nostru ar dispărea până la boot. */
  var URLMODE = new URLSearchParams(location.search).get('assets');

  /* numele fișierului din prototip, fără cale și fără extensie */
  function slotOf(src) {
    if (!src) return null;
    var m = /(?:^|\/)assets\/([a-z0-9-]+)\.(?:jpg|jpeg|png|webp)(?:[?#].*)?$/i.exec(src);
    return m ? m[1] : null;
  }

  function findIn(text, keys, map) {
    var t = norm(text);
    for (var i = 0; i < keys.length; i++) if (t.indexOf(keys[i]) >= 0) return map[keys[i]];
    return null;
  }

  /* hotelul paginii de hotel — titlul se schimbă în funcție de cardul de pe care ai venit */
  function pageHotel() {
    var t = document.querySelector('.hp-title, .m-hotel-title, .hname-big');
    return t ? findIn(t.textContent, HOTEL_KEYS, M.hotelNames) : null;
  }

  function contextOf(img) {
    var el = img.parentElement, up = 0;
    while (el && up < MAXUP && el !== document.body) {
      if (el.matches && el.matches(NAMED)) {
        var h = findIn(el.textContent, HOTEL_KEYS, M.hotelNames);
        if (h) return { hotel: h };
        var r = findIn(el.textContent, RESORT_KEYS, M.resortNames);
        if (r) return { resort: r };
      }
      el = el.parentElement; up++;
    }
    if (document.body.dataset.page === 'hotel') {
      var ph = pageHotel();
      if (ph) return { hotel: ph };
    }
    return {};
  }

  function resolve(slot, ctx) {
    if (ctx.hotel && M.hotels[ctx.hotel] && M.hotels[ctx.hotel].indexOf(slot) >= 0)
      return ROOT + 'h/' + ctx.hotel + '/' + slot + '.webp';
    if (ctx.resort && M.resorts[ctx.resort]) return ROOT + M.resorts[ctx.resort];
    if (M.mirror[slot]) return ROOT + M.mirror[slot].file;
    return null;
  }

  function paintImg(img, on) {
    var slot = slotOf(img.getAttribute('src'));
    if (!slot) return;
    if (!on) { if (img.hasAttribute('srcset')) img.removeAttribute('srcset'); return; }
    var url = resolve(slot, contextOf(img));
    if (!url) { img.removeAttribute('srcset'); return; }
    if (img.getAttribute('srcset') !== url) img.setAttribute('srcset', url);
  }

  function paint(root, on) {
    if (root.tagName === 'IMG') return paintImg(root, on);
    var list = root.querySelectorAll ? root.querySelectorAll('img') : [];
    for (var i = 0; i < list.length; i++) paintImg(list[i], on);
  }

  var mode = 'proto';
  function get() { return mode; }
  function set(v, remember) {
    mode = v === 'prod' ? 'prod' : 'proto';
    document.body.dataset.assets = mode;
    if (remember !== false) { try { localStorage.setItem(KEY, mode); } catch (e) { } }
    paint(document, mode === 'prod');
  }

  function boot() {
    if (!M) return;                       // fără manifest rămânem pe pozele prototipului
    var q = URLMODE;
    if (!q) { try { q = localStorage.getItem(KEY); } catch (e) { } }
    /* dacă modul vine din URL îl ținem minte, altfel s-ar pierde la primul clic:
       legăturile interne se rescriu din starea căutării și nu duc parametrul mai departe */
    set(q === 'prod' ? 'prod' : 'proto', !!URLMODE);

    /* pozele apar și după boot: galeriile cardurilor, lightbox-ul, camerele,
       caruselele — deci urmărim ce se adaugă în DOM și ce își schimbă `src`. */
    new MutationObserver(function (recs) {
      if (mode !== 'prod') return;
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'attributes') { paintImg(r.target, true); continue; }
        for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (n.nodeType === 1) paint(n, true);
        }
      }
    }).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['src']
    });
  }

  /* de rechemat după ce prototipul își schimbă conținutul „dintr-o bucată” —
     de exemplu titlul paginii de hotel, care decide din ce hotel sunt pozele */
  function repaint() { if (M) paint(document, mode === 'prod'); }

  window.LITRO_ASSETS = { get: get, set: set, repaint: repaint, available: !!M };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
