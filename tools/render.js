// Render figma frames from nodes.jsonl to standalone HTML (absolute positioning)
// usage: node render.js <dir> <frameId> [frameId...]
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const frameIds = process.argv.slice(3);

function* jsonlLines(p) {
  const buf = fs.readFileSync(p);
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 10) {
      if (i > start) yield buf.subarray(start, i).toString('utf8');
      start = i + 1;
    }
  }
}

console.error('loading nodes...');
const byId = new Map();
const children = new Map(); // parent -> [{id,pos}]
for (const line of jsonlLines(path.join(dir, 'nodes.jsonl'))) {
  const n = JSON.parse(line);
  // drop heavy fields we never render
  delete n.pluginData; delete n.fillGeometry; delete n.strokeGeometry;
  delete n.componentPropDefs; // keep? needed for defaults — keep actually
  byId.set(n._id, n);
  if (n._parent) {
    if (!children.has(n._parent)) children.set(n._parent, []);
    children.get(n._parent).push({ id: n._id, pos: n.parentIndex ? n.parentIndex.position : '' });
  }
}
for (const arr of children.values()) arr.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
console.error('loaded', byId.size, 'nodes');

const gid = g => g ? `${g.sessionID}:${g.localID}` : null;
const okey = n => n ? (n.overrideKey ? gid(n.overrideKey) : n._id) : null;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cssColor(c, opacity) {
  const a = (c.a != null ? c.a : 1) * (opacity != null ? opacity : 1);
  const f = x => Math.round(x * 255);
  return a >= 1 ? `rgb(${f(c.r)},${f(c.g)},${f(c.b)})` : `rgba(${f(c.r)},${f(c.g)},${f(c.b)},${a.toFixed(3)})`;
}

function imageFile(hashHex) {
  const p = path.join(dir, 'images', hashHex);
  return fs.existsSync(p) ? `images/${hashHex}` : null;
}

function paintCss(p) {
  // returns {image, color} pieces for background stack
  if (p.visible === false) return null;
  if (p.type === 'SOLID') return { color: cssColor(p.color, p.opacity) };
  if (p.type === 'IMAGE') {
    let f = p.image && imageFile(p.image.hash);
    if (!f && p.imageThumbnail) f = imageFile(p.imageThumbnail.hash);
    if (!f) return { color: 'rgba(200,200,200,0.5)' };
    const size = p.imageScaleMode === 'FIT' ? 'contain' : p.imageScaleMode === 'STRETCH' ? '100% 100%' : p.imageScaleMode === 'TILE' ? 'auto' : 'cover';
    const repeat = p.imageScaleMode === 'TILE' ? 'repeat' : 'no-repeat';
    return { image: `url('${f}')`, size, repeat, position: 'center', opacity: p.opacity };
  }
  if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL' || p.type === 'GRADIENT_ANGULAR' || p.type === 'GRADIENT_DIAMOND') {
    const stops = (p.stops || []).map(s => `${cssColor(s.color, p.opacity)} ${Math.round((s.position || 0) * 100)}%`).join(', ');
    if (!stops) return null;
    if (p.type === 'GRADIENT_LINEAR') {
      let deg = 180;
      if (p.transform) deg = 90 + Math.atan2(p.transform.m10 || 0, p.transform.m00 || 1) * 180 / Math.PI;
      return { image: `linear-gradient(${Math.round(deg)}deg, ${stops})`, size: 'auto', repeat: 'no-repeat', position: '0 0' };
    }
    return { image: `radial-gradient(circle at center, ${stops})`, size: 'auto', repeat: 'no-repeat', position: '0 0' };
  }
  return null;
}

function backgroundCss(paints) {
  if (!paints || !paints.length) return '';
  const layers = [];
  let solid = null;
  for (const p of paints) {
    const r = paintCss(p);
    if (!r) continue;
    if (r.color !== undefined && !r.image) solid = r.color; // last solid wins as base
    else if (r.image) layers.push(r);
  }
  let css = '';
  if (layers.length) {
    // css background layers: first = topmost; figma paints: last = topmost → reverse
    const rev = layers.slice().reverse();
    css += `background-image:${rev.map(l => l.image).join(',')};`;
    css += `background-size:${rev.map(l => l.size || 'cover').join(',')};`;
    css += `background-repeat:${rev.map(l => l.repeat || 'no-repeat').join(',')};`;
    css += `background-position:${rev.map(l => l.position || 'center').join(',')};`;
  }
  if (solid !== null) css += `background-color:${solid};`;
  return css;
}

function radiusCss(n) {
  if (n.type === 'ELLIPSE') return 'border-radius:50%;';
  const tl = n.rectangleTopLeftCornerRadius, tr = n.rectangleTopRightCornerRadius,
    br = n.rectangleBottomRightCornerRadius, bl = n.rectangleBottomLeftCornerRadius;
  if (tl != null || tr != null || br != null || bl != null)
    return `border-radius:${tl || 0}px ${tr || 0}px ${br || 0}px ${bl || 0}px;`;
  if (n.cornerRadius) return `border-radius:${n.cornerRadius}px;`;
  return '';
}

function effectsCss(n) {
  const shadows = [];
  let filter = '';
  for (const e of (n.effects || [])) {
    if (e.visible === false) continue;
    if (e.type === 'DROP_SHADOW') shadows.push(`${(e.offset && e.offset.x) || 0}px ${(e.offset && e.offset.y) || 0}px ${e.radius || 0}px ${e.spread || 0}px ${cssColor(e.color || { r: 0, g: 0, b: 0, a: 0.25 })}`);
    if (e.type === 'INNER_SHADOW') shadows.push(`inset ${(e.offset && e.offset.x) || 0}px ${(e.offset && e.offset.y) || 0}px ${e.radius || 0}px ${e.spread || 0}px ${cssColor(e.color || { r: 0, g: 0, b: 0, a: 0.25 })}`);
    if (e.type === 'FOREGROUND_BLUR') filter += `filter:blur(${(e.radius || 0) / 2}px);`;
    if (e.type === 'BACKGROUND_BLUR') filter += `backdrop-filter:blur(${(e.radius || 0) / 2}px);`;
  }
  return (shadows.length ? `box-shadow:${shadows.join(',')};` : '') + filter;
}

function strokeCss(n) {
  const paints = (n.strokePaints || []).filter(p => p.visible !== false && p.type === 'SOLID');
  if (!paints.length) return '';
  const color = cssColor(paints[0].color, paints[0].opacity);
  const w = n.strokeWeight != null ? n.strokeWeight : 1;
  // per-side?
  const t = n.borderTopWeight, r = n.borderRightWeight, b = n.borderBottomWeight, l = n.borderLeftWeight;
  if (t != null || r != null || b != null || l != null) {
    let css = '';
    if (t) css += `border-top:${t}px solid ${color};`;
    if (r) css += `border-right:${r}px solid ${color};`;
    if (b) css += `border-bottom:${b}px solid ${color};`;
    if (l) css += `border-left:${l}px solid ${color};`;
    return css; // box-sizing:border-box keeps size; children offset slightly — acceptable
  }
  if (n.strokeAlign === 'OUTSIDE') return `outline:${w}px solid ${color};outline-offset:0px;`;
  return `box-shadow:inset 0 0 0 ${w}px ${color};`;
}

function fontCss(n) {
  const fam = n.fontName ? n.fontName.family : 'DM Sans';
  const style = (n.fontName ? n.fontName.style : '') || '';
  let weight = 400;
  const s = style.toLowerCase().replace(/\s/g, '');
  if (s.includes('thin')) weight = 100;
  else if (s.includes('extralight')) weight = 200;
  else if (s.includes('light')) weight = 300;
  else if (s.includes('semibold')) weight = 600;
  else if (s.includes('extrabold')) weight = 800;
  else if (s.includes('bold')) weight = 700;
  else if (s.includes('black')) weight = 900;
  else if (s.includes('medium')) weight = 500;
  const italic = s.includes('italic') ? 'font-style:italic;' : '';
  return `font-family:'${fam}',sans-serif;font-weight:${weight};${italic}`;
}

function textCss(n) {
  let css = fontCss(n);
  css += `font-size:${n.fontSize || 14}px;`;
  const fill = (n.fillPaints || []).find(p => p.visible !== false && p.type === 'SOLID');
  css += `color:${fill ? cssColor(fill.color, fill.opacity) : '#000'};`;
  if (n.lineHeight) {
    if (n.lineHeight.units === 'PIXELS') css += `line-height:${n.lineHeight.value}px;`;
    else if (n.lineHeight.units === 'PERCENT' && n.lineHeight.value) css += `line-height:${n.lineHeight.value / 100};`;
    else css += 'line-height:1.2;';
  } else css += 'line-height:1.2;';
  if (n.letterSpacing && n.letterSpacing.value) {
    css += n.letterSpacing.units === 'PIXELS' ? `letter-spacing:${n.letterSpacing.value}px;` : `letter-spacing:${(n.letterSpacing.value / 100)}em;`;
  }
  const ah = n.textAlignHorizontal;
  if (ah === 'CENTER') css += 'text-align:center;';
  else if (ah === 'RIGHT') css += 'text-align:right;';
  else if (ah === 'JUSTIFIED') css += 'text-align:justify;';
  const av = n.textAlignVertical;
  css += 'display:flex;flex-direction:column;';
  if (av === 'CENTER') css += 'justify-content:center;';
  else if (av === 'BOTTOM') css += 'justify-content:flex-end;';
  if (n.textCase === 'UPPER') css += 'text-transform:uppercase;';
  else if (n.textCase === 'LOWER') css += 'text-transform:lowercase;';
  else if (n.textCase === 'TITLE') css += 'text-transform:capitalize;';
  if (n.textDecoration === 'UNDERLINE') css += 'text-decoration:underline;';
  else if (n.textDecoration === 'STRIKETHROUGH') css += 'text-decoration:line-through;';
  return css;
}

// ---------- instance override machinery ----------
// stack of {baseDepth, map: Map<pathKey, overrideObj>, assigns: Map<defId, value>}
function buildOverrideMap(symbolData) {
  const m = new Map();
  for (const o of (symbolData.symbolOverrides || [])) {
    if (!o.guidPath || !o.guidPath.guids) continue;
    const key = o.guidPath.guids.map(gid).join('/');
    if (!m.has(key)) m.set(key, {});
    Object.assign(m.get(key), o);
  }
  return m;
}
function buildDerivedMap(derived) {
  const m = new Map();
  for (const o of (derived || [])) {
    if (!o.guidPath || !o.guidPath.guids) continue;
    const key = o.guidPath.guids.map(gid).join('/');
    if (!m.has(key)) m.set(key, {});
    Object.assign(m.get(key), o);
  }
  return m;
}
function buildAssigns(inst) {
  const m = new Map();
  for (const a of (inst.componentPropAssignments || [])) {
    if (a.defID) m.set(gid(a.defID), a.value);
  }
  return m;
}

const MAX_NODES = 250000;
let emitted = 0;

function renderNodeClean(id, ctx, out, depth) {
  if (emitted > MAX_NODES || depth > 100) return;
  const orig = byId.get(id);
  if (!orig) return;
  let n = orig;
  let override = null, derived = null, overrideChars, swapSym = null;
  if (ctx.stack.length) {
    const ok = okey(orig);
    // innermost first, outermost LAST so outermost wins
    for (let li = ctx.stack.length - 1; li >= 0; li--) {
      const layer = ctx.stack[li];
      const rel = ctx.chain.slice(layer.baseLen).concat([ok]).join('/');
      const o = layer.map.get(rel);
      if (o) {
        override = Object.assign(override || {}, o);
        if (o.textData && o.textData.characters != null) overrideChars = o.textData.characters;
        if (o.overriddenSymbolID) swapSym = gid(o.overriddenSymbolID);
      }
      const d = layer.derived.get(rel);
      if (d) derived = Object.assign(derived || {}, d);
    }
  }
  if (override || derived) {
    n = Object.assign({}, orig, override || {}, derived || {});
    if (overrideChars != null) n.characters = overrideChars;
    if (swapSym) n._swapSymbol = swapSym;
  }
  if (orig.componentPropRefs) {
    for (const ref of orig.componentPropRefs) {
      const key = ref.defID ? gid(ref.defID) : null;
      if (!key) continue;
      for (let i = 0; i < ctx.stack.length; i++) {
        const layer = ctx.stack[i];
        if (layer.assigns.has(key)) {
          const v = layer.assigns.get(key);
          if (ref.componentPropNodeField === 'VISIBLE' && v && v.boolValue != null) n = Object.assign({}, n, { visible: v.boolValue });
          if (ref.componentPropNodeField === 'TEXT_DATA' && v && v.textValue != null) {
            const tv = v.textValue;
            n = Object.assign({}, n, { characters: (tv && typeof tv === 'object') ? (tv.characters || '') : tv });
          }
          if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID' && v && v.guidValue) n = Object.assign({}, n, { _swapSymbol: gid(v.guidValue) });
          break;
        }
      }
    }
  }
  if (n.visible === false) return;

  const t = n.transform || { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  const w = n.size ? n.size.x : 0, h = n.size ? n.size.y : 0;
  const isRoot = depth === 0;
  let style = isRoot
    ? `position:relative;width:${w}px;height:${h}px;`
    : `position:absolute;left:0;top:0;width:${w}px;height:${h}px;`;
  if (!isRoot) {
    const simple = Math.abs(t.m00 - 1) < 1e-6 && Math.abs(t.m11 - 1) < 1e-6 && Math.abs(t.m01) < 1e-6 && Math.abs(t.m10) < 1e-6;
    if (simple) style += `transform:translate(${t.m02}px,${t.m12}px);`;
    else style += `transform:matrix(${t.m00},${t.m10},${t.m01},${t.m11},${t.m02},${t.m12});transform-origin:0 0;`;
  }
  if (n.opacity != null && n.opacity < 1) style += `opacity:${n.opacity};`;

  const type = n.type;
  const kids = children.get(id) || [];
  const title = esc((n.name || '') + ' ' + id);

  if (type === 'TEXT') {
    const chars = n.characters != null ? n.characters : (n.textData && n.textData.characters) || '';
    if (process.env.DBG) {
      const rels = ctx.stack.map(l => ctx.chain.slice(l.baseLen).concat([okey(orig)]).join('/'));
      console.error('TEXT', id, 'ok=' + okey(orig), JSON.stringify(String(chars).slice(0, 20)), 'chain=' + ctx.chain.join('>'), 'rels=' + JSON.stringify(rels), 'ovr=' + !!override);
    }
    style += 'box-sizing:border-box;' + textCss(n);
    out.push(`<div style="${style}" title="${title}"><span>${esc(chars).replace(/[\u2028\u2029]/g,'<br>')}</span></div>`);
    emitted++;
    return;
  }

  style += 'box-sizing:border-box;';
  style += backgroundCss(n.fillPaints);
  style += radiusCss(n);
  style += strokeCss(n);
  style += effectsCss(n);
  if (type === 'FRAME' || type === 'SYMBOL' || type === 'INSTANCE') {
    if (!n.frameMaskDisabled) style += 'overflow:hidden;';
  }
  if (type === 'LINE') {
    const sp = (n.strokePaints || []).find(p => p.visible !== false && p.type === 'SOLID');
    if (sp) style += `background-color:${cssColor(sp.color, sp.opacity)};height:${Math.max(1, n.strokeWeight || 1)}px;`;
  }
  if ((type === 'VECTOR' || type === 'BOOLEAN_OPERATION' || type === 'ELLIPSE' || type === 'STAR' || type === 'REGULAR_POLYGON') && !kids.length) {
    if (!/background/.test(style)) {
      const sp = (n.strokePaints || []).find(p => p.visible !== false && p.type === 'SOLID');
      if (sp) style += `box-shadow:inset 0 0 0 ${Math.max(1, n.strokeWeight || 1)}px ${cssColor(sp.color, sp.opacity)};`;
    }
  }

  out.push(`<div style="${style}" title="${title}">`);
  emitted++;

  const symId = n._swapSymbol || (type === 'INSTANCE' && n.symbolData ? gid(n.symbolData.symbolID) : null);
  if (symId) {
    const sym = byId.get(symId);
    if (sym) {
      const usf = (n.symbolData && n.symbolData.uniformScaleFactor) || 1;
      if (usf !== 1) out.push(`<div style="position:absolute;left:0;top:0;transform:scale(${usf});transform-origin:0 0;">`);
      const newChain = ctx.chain.concat([okey(orig)]);
      const layer = {
        baseLen: newChain.length,
        map: buildOverrideMap(n.symbolData || {}),
        derived: buildDerivedMap(n.derivedSymbolData),
        assigns: buildAssigns(n),
      };
      const newStack = ctx.stack.concat([layer]);
      for (const c of (children.get(symId) || [])) {
        renderNodeClean(c.id, { chain: newChain, stack: newStack }, out, depth + 1);
      }
      if (usf !== 1) out.push('</div>');
    }
  } else {
    for (const c of kids) {
      renderNodeClean(c.id, ctx, out, depth + 1);
    }
  }
  out.push('</div>');
}

const outDir = path.join(dir, 'render');
fs.mkdirSync(outDir, { recursive: true });
// symlink images dir for relative refs
const imgLink = path.join(outDir, 'images');
if (!fs.existsSync(imgLink)) { try { fs.symlinkSync(path.join(dir, 'images'), imgLink); } catch (e) {} }

for (const fid of frameIds) {
  emitted = 0;
  const n = byId.get(fid);
  if (!n) { console.error('frame not found:', fid); continue; }
  const out = [];
  renderNodeClean(fid, { chain: [], stack: [] }, out, 0);
  const html = `<!doctype html><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,100..1000&family=Outfit:wght@100..900&family=Work+Sans:wght@100..900&family=Plus+Jakarta+Sans:wght@200..800&family=Inter:wght@100..900&family=Roboto:wght@100..900&display=swap" rel="stylesheet">
<style>body{margin:0;background:#888;}*{box-sizing:border-box;}div{pointer-events:auto;}span{white-space:pre-wrap;}</style>
<body>${out.join('\n')}</body>`;
  const fname = `${fid.replace(':', '_')}.html`;
  fs.writeFileSync(path.join(outDir, fname), html);
  console.log(`rendered ${fid} "${n.name}" -> render/${fname} (${emitted} nodes, ${Math.round(html.length / 1024)}KB)`);
}
