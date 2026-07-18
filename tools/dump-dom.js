// Dump absolute-positioned visual tree of a page via puppeteer-core
// usage: node dump-dom.js <fileUrl> <out.json>
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  await page.goto(process.argv[2], { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));

  const data = await page.evaluate(async () => {
    const out = [];
    const sx = () => window.scrollX, sy = () => window.scrollY;

    function styleOf(el) { return getComputedStyle(el); }
    function rectOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.x + sx(), y: r.y + sy(), w: r.width, h: r.height };
    }
    function parseColor(c) {
      if (!c || c === 'transparent') return null;
      const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a === 0) return null;
      return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a };
    }
    function parseShadows(s) {
      if (!s || s === 'none') return [];
      // computed format: "rgba(30, 30, 30, 0.08) 0px 1px 3px 0px, ..." (inset prefix possible)
      const parts = s.split(/,(?![^(]*\))/).map(x => x.trim());
      const res = [];
      for (const p of parts) {
        const inset = /(^|\s)inset(\s|$)/.test(p);
        const col = parseColor(p);
        const nums = (p.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
        if (col && nums.length >= 2) res.push({ inset, color: col, x: nums[0], y: nums[1], blur: nums[2] || 0, spread: nums[3] || 0 });
      }
      return res;
    }
    function parseGradient(bgImage) {
      const m = bgImage.match(/linear-gradient\((?:([\d.]+)deg,\s*)?(.+)\)$/);
      if (!m) return null;
      const angle = m[1] !== undefined ? parseFloat(m[1]) : 180;
      const stopsRaw = m[2].split(/,(?![^(]*\))/).map(x => x.trim());
      const stops = [];
      for (const s of stopsRaw) {
        const col = parseColor(s);
        const pos = s.match(/([\d.]+)%/);
        if (col) stops.push({ color: col, position: pos ? +pos[1] / 100 : null });
      }
      // fill null positions evenly
      stops.forEach((s, i) => { if (s.position === null) s.position = stops.length === 1 ? 0 : i / (stops.length - 1); });
      return { angle, stops };
    }

    async function svgToPng(svg, w, h) {
      const clone = svg.cloneNode(true);
      // resolve currentColor
      const color = getComputedStyle(svg).color;
      clone.setAttribute('color', color);
      // inline <use> references
      clone.querySelectorAll('use').forEach(u => {
        const ref = u.getAttribute('href') || u.getAttribute('xlink:href');
        if (ref && ref.startsWith('#')) {
          const sym = document.querySelector(ref);
          if (sym) {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.innerHTML = sym.innerHTML;
            if (sym.getAttribute('viewBox')) clone.setAttribute('viewBox', sym.getAttribute('viewBox'));
            u.replaceWith(g);
          }
        }
      });
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const s = new XMLSerializer().serializeToString(clone);
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = res; img.src = url; });
      const canvas = document.createElement('canvas');
      const S = 3;
      canvas.width = Math.max(1, Math.round(w * S)); canvas.height = Math.max(1, Math.round(h * S));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { return canvas.toDataURL('image/png'); } catch (e) { return null; }
    }

    let idc = 0;
    async function walk(el, parentId, clipShift) {
      const st = styleOf(el);
      if (st.display === 'none' || st.visibility === 'hidden') return;
      const r = rectOf(el);
      if (r.w < 0.5 || r.h < 0.5) return;
      const tag = el.tagName.toLowerCase();
      const id = ++idc;

      const node = { id, parent: parentId, tag, name: el.className && typeof el.className === 'string' ? tag + '.' + el.className.split(' ')[0] : tag, rect: r };

      // svg → rasterize, no children
      if (tag === 'svg') {
        if (r.w <= 64 && r.h <= 64) {
          node.type = 'icon';
          node.png = await svgToPng(el, r.w, r.h);
          out.push(node);
          return;
        } else { return; } // sprite defs container (w=0 skipped anyway)
      }
      if (tag === 'img') {
        node.type = 'img';
        node.src = el.currentSrc || el.src;
        node.objectFit = st.objectFit || 'fill';
        node.radius = [st.borderTopLeftRadius, st.borderTopRightRadius, st.borderBottomRightRadius, st.borderBottomLeftRadius].map(parseFloat);
        node.opacity = parseFloat(st.opacity);
        out.push(node);
        return;
      }

      // container/box
      node.type = 'box';
      node.bg = parseColor(st.backgroundColor);
      node.gradient = st.backgroundImage && st.backgroundImage.includes('linear-gradient') ? parseGradient(st.backgroundImage) : null;
      node.bgUrl = (st.backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1] || null;
      node.bgSize = st.backgroundSize;
      node.radius = [st.borderTopLeftRadius, st.borderTopRightRadius, st.borderBottomRightRadius, st.borderBottomLeftRadius].map(parseFloat);
      node.borders = {
        t: { w: parseFloat(st.borderTopWidth), c: parseColor(st.borderTopColor) },
        r: { w: parseFloat(st.borderRightWidth), c: parseColor(st.borderRightColor) },
        b: { w: parseFloat(st.borderBottomWidth), c: parseColor(st.borderBottomColor) },
        l: { w: parseFloat(st.borderLeftWidth), c: parseColor(st.borderLeftColor) },
      };
      node.shadows = parseShadows(st.boxShadow);
      node.opacity = parseFloat(st.opacity);
      node.clips = ['hidden', 'clip', 'auto', 'scroll'].includes(st.overflow) || st.overflow.includes('hidden');
      out.push(node);

      // pseudo-elements (overlays, generated content)
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (!ps || ps.content === 'none' || ps.display === 'none') continue;
        const hasBg = parseColor(ps.backgroundColor) || ps.backgroundImage.includes('linear-gradient');
        const txtContent = ps.content && ps.content !== 'normal' && ps.content !== '""' ? ps.content.replace(/^"|"$/g, '') : '';
        if (!hasBg && !txtContent) continue;
        const pid = ++idc;
        out.push({
          id: pid, parent: id, type: 'box', tag: 'pseudo', name: 'overlay', rect: { ...r },
          bg: parseColor(ps.backgroundColor),
          gradient: ps.backgroundImage.includes('linear-gradient') ? parseGradient(ps.backgroundImage) : null,
          bgUrl: null, bgSize: 'auto',
          radius: node.radius, borders: { t:{w:0},r:{w:0},b:{w:0},l:{w:0} }, shadows: [], opacity: 1, clips: false,
        });
        if (txtContent) {
          const tid = ++idc;
          out.push({
            id: tid, parent: pid, type: 'text', tag: 'text', rect: { x: r.x, y: r.y + r.h / 2 - 10, w: r.w, h: 20 },
            text: txtContent,
            font: { family: ps.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(ps.fontSize) || 14, weight: +ps.fontWeight || 700, italic: false },
            color: parseColor(ps.color) || { r: 1, g: 1, b: 1, a: 1 },
            lineHeight: 20, letterSpacing: 0, align: 'center', transform: 'none', decoration: 'none',
          });
        }
      }

      // direct text content → text nodes (group consecutive text of same element)
      let textBuf = '';
      const flushText = () => {
        if (!textBuf.trim()) { textBuf = ''; return; }
        // measure text rects via range over all child text nodes
        textBuf = '';
      };
      // collect text: if element has direct non-empty text nodes, emit ONE text node with el's text styling and content = el.innerText (only if no element children OR mixed)
      const directTextNodes = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim());
      const hasElemKids = el.children.length > 0;
      if (directTextNodes.length && hasElemKids) {
        // mixed content: one text node per run, exact rects
        for (const tn of directTextNodes) {
          const rg = document.createRange(); rg.selectNodeContents(tn);
          const rr = rg.getBoundingClientRect();
          if (rr.width < 1) continue;
          const tid = ++idc;
          out.push({
            id: tid, parent: id, type: 'text', tag: 'text',
            rect: { x: rr.x + sx(), y: rr.y + sy(), w: Math.max(2, rr.width), h: Math.max(2, rr.height) },
            text: tn.textContent.replace(/\s+/g, ' ').trim(),
            font: { family: st.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(st.fontSize), weight: +st.fontWeight || 400, italic: st.fontStyle === 'italic' },
            color: parseColor(st.color),
            lineHeight: parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.2,
            letterSpacing: st.letterSpacing === 'normal' ? 0 : parseFloat(st.letterSpacing),
            align: 'left', transform: st.textTransform, decoration: st.textDecorationLine,
          });
        }
      }
      const directText = directTextNodes.map(n => n.textContent).join('');
      if (directText.trim() && !hasElemKids) {
        // text rect: use range
        let tr = null;
        for (const tn of Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim())) {
          const rg = document.createRange(); rg.selectNodeContents(tn);
          const rr = rg.getBoundingClientRect();
          if (!tr) tr = { x: rr.x, y: rr.y, right: rr.right, bottom: rr.bottom };
          else { tr.x = Math.min(tr.x, rr.x); tr.y = Math.min(tr.y, rr.y); tr.right = Math.max(tr.right, rr.right); tr.bottom = Math.max(tr.bottom, rr.bottom); }
        }
        tr = tr ? { x: tr.x, y: tr.y, width: tr.right - tr.x, height: tr.bottom - tr.y } : el.getBoundingClientRect();
        const tid = ++idc;
        out.push({
          id: tid, parent: id, type: 'text', tag: 'text',
          rect: { x: tr.x + sx(), y: tr.y + sy(), w: Math.max(2, tr.width), h: Math.max(2, tr.height) },
          text: hasElemKids ? directText.trim() : el.innerText.trim(),
          font: { family: st.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(st.fontSize), weight: +st.fontWeight || 400, italic: st.fontStyle === 'italic' },
          color: parseColor(st.color),
          lineHeight: parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.2,
          letterSpacing: st.letterSpacing === 'normal' ? 0 : parseFloat(st.letterSpacing),
          align: st.textAlign,
          transform: st.textTransform,
          decoration: st.textDecorationLine,
        });
        if (!hasElemKids) return; // pure text leaf: done
      }
      for (const c of el.children) await walk(c, id, clipShift);
    }

    await walk(document.body, 0, null);
    return out;
  });

  fs.writeFileSync(process.argv[3], JSON.stringify(data));
  console.log('nodes:', data.length, '->', process.argv[3]);
  await browser.close();
})();
