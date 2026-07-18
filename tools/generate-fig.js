// Generate a real .fig file from DOM dumps
// usage: node generate-fig.js <out.fig>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pako = require('pako');
const { decodeBinarySchema, compileSchema } = require('kiwi-schema');
const { execSync } = require('child_process');

const SCRATCH = __dirname;
const ASSETS = '/Users/mkoslacz/Workspaces/claude/litoralul_nop_designs/desktop-redesign/assets';
const outFig = process.argv[2] || 'litro-desktop-redesign.fig';

// ---- load schema from litro canvas.fig (chunk0 verbatim) ----
const src = fs.readFileSync(path.join(SCRATCH, 'litro/canvas.fig'));
let off = 8;
const version = src.readUInt32LE(off); off += 4;
const len0 = src.readUInt32LE(off); off += 4;
const chunk0raw = src.subarray(off, off + len0); // keep compressed bytes verbatim
const schemaBytes = pako.inflateRaw(chunk0raw);
const schema = compileSchema(decodeBinarySchema(schemaBytes));
console.log('schema ok, version', version);

// ---- image registry ----
const images = new Map(); // sha1hex -> {bytes, name}
function sha1(buf) { return crypto.createHash('sha1').update(buf).digest(); }
function regImage(bytes, name) {
  const h = sha1(bytes);
  const hex = h.toString('hex');
  if (!images.has(hex)) images.set(hex, { bytes, name });
  return h;
}
function imgDims(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) { // png
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) { // jpeg
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return { w: 100, h: 100 };
}

// ---- helpers ----
const IDENT = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
function pos(i) { // fractional index position strings, strictly increasing
  const A = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}';
  if (i < A.length) return A[i];
  return A[Math.floor(i / A.length) - 1] + A[i % A.length];
}
function solid(c) {
  return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b, a: 1 }, opacity: c.a != null ? c.a : 1, visible: true, blendMode: 'NORMAL' };
}
function gradientPaint(g, w, h) {
  // css angle: 0=to top, 90=to right; direction in (u,v) with v down
  const th = (g.angle * Math.PI) / 180;
  const dx = Math.sin(th), dy = -Math.cos(th) * -1; // css: 180deg → to bottom → d=(0,1)
  // Actually: css angle 0 = to top → d=(0,-1); 180 → (0,1); 90 → (1,0)
  const ddx = Math.sin(th), ddy = -Math.cos(th);
  const t = {
    m00: ddx, m01: ddy, m02: 0.5 - 0.5 * (ddx + ddy),
    m10: -ddy, m11: ddx, m12: 0.5 - 0.5 * (ddx - ddy),
  };
  return {
    type: 'GRADIENT_LINEAR', opacity: 1, visible: true, blendMode: 'NORMAL',
    stops: g.stops.map(s => ({ color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a }, position: s.position })),
    transform: t,
  };
}
function imagePaint(bytes, name, scaleMode) {
  const h = regImage(bytes, name);
  const d = imgDims(bytes);
  return {
    type: 'IMAGE', opacity: 1, visible: true, blendMode: 'NORMAL', transform: IDENT,
    image: { hash: h, name: name || '' }, imageScaleMode: scaleMode || 'FILL',
    imageShouldColorManage: true, rotation: 0, scale: 0.5,
    originalImageWidth: d.w, originalImageHeight: d.h,
  };
}
function styleFromWeight(w, italic) {
  const map = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  const base = map[w] || 'Regular';
  if (!italic) return base;
  return base === 'Regular' ? 'Italic' : base + ' Italic';
}

// ---- build nodeChanges ----
const nodeChanges = [];
const S = 1; // content sessionID
let localCounter = 1;

nodeChanges.push({
  guid: { sessionID: 0, localID: 0 }, phase: 'CREATED', type: 'DOCUMENT', name: 'Document',
  visible: true, opacity: 1, transform: IDENT, strokeWeight: 0, strokeAlign: 'CENTER', strokeJoin: 'BEVEL',
});
nodeChanges.push({
  guid: { sessionID: 0, localID: 1 }, phase: 'CREATED', type: 'CANVAS', name: 'LITRO Desktop',
  parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
  visible: true, opacity: 1, transform: IDENT, strokeWeight: 0, strokeAlign: 'CENTER', strokeJoin: 'BEVEL',
  backgroundColor: { r: 0.949, g: 0.945, b: 0.941, a: 1 }, backgroundOpacity: 1, backgroundEnabled: true,
});

const pages = [
  { file: 'dump-home.json', name: 'Home / Desktop', ox: 0 },
  { file: 'dump-listing.json', name: 'Listing / Desktop', ox: 1640 },
  { file: 'dump-hotel.json', name: 'Hotel Details / Desktop', ox: 3280 },
  { file: 'dump-checkout.json', name: 'Checkout / Desktop', ox: 4920 },
  { file: 'dump-thankyou.json', name: 'Thank you / Desktop', ox: 6560 },
];

const assetCache = new Map();
function loadAsset(url) {
  const m = url.match(/assets\/([^/?"']+)$/);
  if (!m) return null;
  const p = path.join(ASSETS, m[1]);
  if (!assetCache.has(p)) {
    try { assetCache.set(p, fs.readFileSync(p)); } catch (e) { assetCache.set(p, null); }
  }
  return assetCache.get(p) ? { bytes: assetCache.get(p), name: m[1] } : null;
}

for (const page of pages) {
  const dump = JSON.parse(fs.readFileSync(path.join(SCRATCH, page.file), 'utf8'));
  const byId = new Map(dump.map(n => [n.id, n]));
  const kids = new Map();
  for (const n of dump) {
    if (!kids.has(n.parent)) kids.set(n.parent, []);
    kids.get(n.parent).push(n.id);
  }
  const body = dump[0]; // body is first
  const figIds = new Map(); // dump id -> guid
  const childCounters = new Map();

  function guidFor(dumpId) {
    if (!figIds.has(dumpId)) figIds.set(dumpId, { sessionID: S, localID: localCounter++ });
    return figIds.get(dumpId);
  }

  function emit(n, parentDumpId, parentRect, isRoot) {
    const g = guidFor(n.id);
    const parentGuid = isRoot ? { sessionID: 0, localID: 1 } : guidFor(parentDumpId);
    const idx = (childCounters.get(parentDumpId ?? 'root') || 0);
    childCounters.set(parentDumpId ?? 'root', idx + 1);
    const relX = isRoot ? page.ox : n.rect.x - parentRect.x;
    const relY = isRoot ? 0 : n.rect.y - parentRect.y;

    const node = {
      guid: g, phase: 'CREATED',
      parentIndex: { guid: parentGuid, position: pos(idx) },
      visible: true, opacity: n.opacity != null && !isRoot ? n.opacity : 1,
      transform: { ...IDENT, m02: relX, m12: relY },
      size: { x: Math.max(1, n.rect.w), y: Math.max(1, n.rect.h) },
      strokeWeight: 0, strokeAlign: 'INSIDE', strokeJoin: 'MITER',
    };

    if (n.type === 'text') {
      node.type = 'TEXT';
      node.name = (n.text || 'text').slice(0, 40);
      node.size = { x: Math.max(2, n.rect.w + 2), y: Math.max(2, n.rect.h) };
      node.fontSize = n.font.size;
      node.fontName = { family: n.font.family, style: styleFromWeight(n.font.weight, n.font.italic), postscript: '' };
      node.textData = { characters: n.text, lines: [{ lineType: 'PLAIN', styleId: 0, indentationLevel: 0, sourceDirectionality: 'AUTO', listStartOffset: 0, isFirstLineOfList: false }] };
      node.lineHeight = { value: n.lineHeight, units: 'PIXELS' };
      if (n.letterSpacing) node.letterSpacing = { value: n.letterSpacing, units: 'PIXELS' };
      node.textAlignHorizontal = n.align === 'center' ? 'CENTER' : (n.align === 'right' || n.align === 'end') ? 'RIGHT' : n.align === 'justify' ? 'JUSTIFIED' : 'LEFT';
      node.textAlignVertical = 'TOP';
      node.textAutoResize = n.text.includes('\n') ? 'NONE' : 'WIDTH_AND_HEIGHT';
      if (n.text.includes('\n')) node.size = { x: Math.max(2, n.rect.w + 4), y: Math.max(2, n.rect.h + 2) };
      if (n.transform === 'uppercase') node.textCase = 'UPPER';
      if (n.decoration && n.decoration.includes('underline')) node.textDecoration = 'UNDERLINE';
      if (n.decoration && n.decoration.includes('line-through')) node.textDecoration = 'STRIKETHROUGH';
      node.fillPaints = [solid(n.color || { r: 0, g: 0, b: 0, a: 1 })];
      nodeChanges.push(node);
      return;
    }

    if (n.type === 'img') {
      node.type = 'ROUNDED_RECTANGLE';
      node.name = 'photo';
      const a = loadAsset(n.src || '');
      const mode = n.objectFit === 'contain' ? 'FIT' : n.objectFit === 'fill' ? 'STRETCH' : 'FILL';
      node.fillPaints = a ? [imagePaint(a.bytes, a.name, mode)] : [solid({ r: .8, g: .8, b: .8, a: 1 })];
      setRadius(node, n.radius);
      nodeChanges.push(node);
      return;
    }

    if (n.type === 'icon') {
      node.type = 'ROUNDED_RECTANGLE';
      node.name = 'icon';
      if (n.png) {
        const bytes = Buffer.from(n.png.split(',')[1], 'base64');
        node.fillPaints = [imagePaint(bytes, 'icon.png', 'FILL')];
      } else node.fillPaints = [];
      nodeChanges.push(node);
      return;
    }

    // box → FRAME
    node.type = 'FRAME';
    node.name = isRoot ? page.name : (n.name || 'div').slice(0, 40);
    if (!n.clips) node.frameMaskDisabled = true;
    const fills = [];
    if (n.bg) fills.push(solid(n.bg));
    if (n.gradient && n.gradient.stops.length >= 2) fills.push(gradientPaint(n.gradient, n.rect.w, n.rect.h));
    if (n.bgUrl) {
      const a = loadAsset(n.bgUrl);
      if (a) fills.push(imagePaint(a.bytes, a.name, n.bgSize === 'contain' ? 'FIT' : 'FILL'));
    }
    node.fillPaints = fills;
    setRadius(node, n.radius);
    // borders
    const b = n.borders || {};
    const ws = [b.t, b.r, b.b, b.l].map(x => (x && x.w) || 0);
    const maxW = Math.max(...ws);
    if (maxW > 0) {
      const bc = (b.t && b.t.c) || (b.l && b.l.c) || (b.b && b.b.c) || (b.r && b.r.c);
      if (bc) {
        node.strokePaints = [solid(bc)];
        node.strokeAlign = 'INSIDE';
        const uniform = ws.every(w => Math.abs(w - ws[0]) < 0.01);
        if (uniform) node.strokeWeight = ws[0];
        else {
          node.strokeWeight = maxW;
          node.borderStrokeWeightsIndependent = true;
          node.borderTopWeight = ws[0]; node.borderRightWeight = ws[1];
          node.borderBottomWeight = ws[2]; node.borderLeftWeight = ws[3];
        }
      }
    }
    // shadows
    const effs = [];
    for (const s of (n.shadows || [])) {
      effs.push({
        type: s.inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        offset: { x: s.x, y: s.y }, radius: s.blur, spread: s.spread || 0,
        visible: true, blendMode: 'NORMAL', showShadowBehindNode: false,
      });
    }
    if (effs.length) node.effects = effs;
    nodeChanges.push(node);

    for (const cid of (kids.get(n.id) || [])) {
      emit(byId.get(cid), n.id, n.rect, false);
    }
  }

  function setRadius(node, radius) {
    if (!radius) return;
    const [tl, tr, br, bl] = radius.map(x => x || 0);
    if (tl || tr || br || bl) {
      node.rectangleTopLeftCornerRadius = tl;
      node.rectangleTopRightCornerRadius = tr;
      node.rectangleBottomRightCornerRadius = br;
      node.rectangleBottomLeftCornerRadius = bl;
      node.rectangleCornerRadiiIndependent = !(tl === tr && tr === br && br === bl);
      if (tl === tr && tr === br && br === bl) node.cornerRadius = tl;
    }
  }

  emit(body, null, body.rect, true);
  console.log(page.name, '→ nodes so far', nodeChanges.length);
}

// ---- encode ----
const message = { type: 'NODE_CHANGES', sessionID: 0, ackID: 0, nodeChanges };
const encoded = schema.encodeMessage(message);
console.log('encoded message:', encoded.length, 'bytes, images:', images.size);

const zlib = require('zlib');
const chunk1 = zlib.zstdCompressSync(Buffer.from(encoded));
const header = Buffer.alloc(12);
header.write('fig-kiwi', 0, 'latin1');
header.writeUInt32LE(version, 8);
const canvasFig = Buffer.concat([
  header,
  u32(chunk0raw.length), Buffer.from(chunk0raw),
  u32(chunk1.length), Buffer.from(chunk1),
]);
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }

// ---- assemble zip ----
const stage = path.join(SCRATCH, 'figout');
execSync(`rm -rf "${stage}" && mkdir -p "${stage}/images"`);
fs.writeFileSync(path.join(stage, 'canvas.fig'), canvasFig);
const meta = {
  client_meta: {
    background_color: { r: 0.949, g: 0.945, b: 0.941, a: 1 },
    thumbnail_size: { width: 400, height: 225 },
    render_coordinates: { x: 0, y: 0, width: 8000, height: 3900 },
  },
  file_name: 'LITRO Desktop Redesign',
  developer_related_links: [],
  exported_at: new Date().toISOString(),
};
fs.writeFileSync(path.join(stage, 'meta.json'), JSON.stringify(meta));
// thumbnail from preview-home
try {
  execSync(`sips -Z 400 "/Users/mkoslacz/Workspaces/claude/litoralul_nop_designs/desktop-redesign/preview-home.png" --out "${stage}/thumbnail.png" >/dev/null 2>&1`);
} catch (e) { fs.writeFileSync(path.join(stage, 'thumbnail.png'), Buffer.from('89504e470d0a1a0a', 'hex')); }
for (const [hex, v] of images) fs.writeFileSync(path.join(stage, 'images', hex), v.bytes);
const outAbs = path.resolve(outFig);
execSync(`cd "${stage}" && rm -f "${outAbs}" && zip -X -q -0 -r "${outAbs}" canvas.fig meta.json thumbnail.png images`);
console.log('wrote', outAbs, fs.statSync(outAbs).size, 'bytes');
