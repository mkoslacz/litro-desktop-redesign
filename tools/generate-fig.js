// Generate a real .fig file from DOM dumps produced by dump-dom.js / dump-frames.js.
//
//   node generate-fig.js [prototype.json] [out.fig]
//
// Every frame listed in the manifest becomes an editable Figma frame; rows are laid
// out top to bottom, frames left to right, with the row height taken from the tallest
// frame in it so nothing overlaps.
//
// Requires: node >= 22 (zlib.zstdCompressSync), `npm i kiwi-schema pako`, and `zip`/`unzip`.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const pako = require('pako');
const { decodeBinarySchema, compileSchema } = require('kiwi-schema');
const { execFileSync } = require('child_process');
const { resolveGenerationManifest } = require('./converter-policy.js');

class GenerateFigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GenerateFigError';
  }
}

function createDependencies(overrides = {}) {
  const runtimeProcess = overrides.process || process;
  return {
    compileSchema: overrides.compileSchema || compileSchema,
    crypto: overrides.crypto || crypto,
    decodeBinarySchema: overrides.decodeBinarySchema || decodeBinarySchema,
    execFileSync: overrides.execFileSync || execFileSync,
    fs: overrides.fs || fs,
    log: overrides.log || console.log,
    now: overrides.now || (() => new Date()),
    os: overrides.os || os,
    pako: overrides.pako || pako,
    path: overrides.path || path,
    pid: overrides.pid ?? runtimeProcess.pid,
    process: runtimeProcess,
    random: overrides.random || Math.random,
    warn: overrides.warn || console.warn,
    zlib: overrides.zlib || zlib,
  };
}

/* ---------- external binaries ----------
   Every system binary goes through here, and every argument is passed as an array
   element rather than interpolated into a command string. Paths in this file come
   from the manifest, which a prototype author writes: as a shell string a path
   containing `"` or `$(…)` would break out of the quoting and run as a command,
   while as an array element it reaches the binary as a literal filename. There is
   no shell in this path at all, so shell redirections (`>/dev/null`) are expressed
   through `stdio` instead. Stdout is discarded — these binaries are run for their
   side effects; stderr goes to the terminal so a fatal failure still says why. */
function run(bin, args, opts, deps) {
  return deps.execFileSync(bin, args, { stdio: ['ignore', 'ignore', 'inherit'], ...opts });
}

function main(argv, overrides = {}) {
  const deps = createDependencies(overrides);
  const { compileSchema, crypto, decodeBinarySchema, fs, os, pako, path, zlib } = deps;
  const arguments_ = argv === undefined ? deps.process.argv.slice(2) : argv;
  /* ---------- manifest ---------- */
  const manifestPath = path.resolve(arguments_[0] || 'prototype.json');
  if (!fs.existsSync(manifestPath)) {
    throw new GenerateFigError('manifest not found: ' + manifestPath + '  (see prototype.example.json)');
  }
  const M = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const ROOT = path.dirname(manifestPath);
  const manifestPaths = resolveGenerationManifest(ROOT, M, arguments_[1], { fs, path });
  const DUMPS = manifestPaths.dumps;
  const ASSETS = manifestPaths.assets;
  const outFig = manifestPaths.out;
  const GAP_X = M.gapX != null ? M.gapX : 200;
  const GAP_Y = M.gapY != null ? M.gapY : 400;

  function hexColor(h, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
  }
  const BG = hexColor(M.background, { r: 0.949, g: 0.945, b: 0.941, a: 1 });

  /* ---------- schema: chunk 0 copied verbatim from a real Figma export ----------
   Figma's own schema is the only one its importer accepts. Point `schemaFrom` at any
   .fig you exported from Figma (or at an already-extracted canvas.fig). The bytes are
   never re-encoded — the deflate-raw chunk is passed through untouched. */
  function schemaSource() {
    const p = manifestPaths.schemaFrom;
    if (!fs.existsSync(p)) {
      throw new GenerateFigError(
        'schema donor not found: ' +
          p +
          '\nExport any file from Figma, then: unzip -o -j <file>.fig canvas.fig -d tools/.schema/'
      );
    }
    // Both a .fig export (a ZIP) and an extracted canvas.fig end in .fig — tell them
    // apart by content, not by name: a raw canvas starts with the fig-kiwi magic.
    // Read exactly the eight magic bytes. readFileSync takes no size option; the one this
    // line used to pass read like a bound, was silently ignored, and pulled in the whole
    // donor file (measured: 5,242,880 of 5,242,880 bytes on node v25.8.2).
    const head = Buffer.alloc(8);
    const fd = fs.openSync(p, 'r');
    let headLen = 0;
    try {
      headLen = fs.readSync(fd, head, 0, 8, 0);
    } finally {
      fs.closeSync(fd);
    }
    // A file shorter than eight bytes cannot carry the magic; compare only what was read.
    if (headLen === 8 && head.toString('latin1', 0, 8) === 'fig-kiwi') return fs.readFileSync(p);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'figschema-'));
    run('unzip', ['-o', '-j', p, 'canvas.fig', '-d', tmp], {}, deps);
    return fs.readFileSync(path.join(tmp, 'canvas.fig'));
  }
  const src = schemaSource();
  let off = 8;
  const version = src.readUInt32LE(off);
  off += 4;
  const len0 = src.readUInt32LE(off);
  off += 4;
  const chunk0raw = src.subarray(off, off + len0); // keep the compressed bytes verbatim
  const schema = compileSchema(decodeBinarySchema(pako.inflateRaw(chunk0raw)));
  deps.log('schema ok, fig version', version);

  /* ---------- image registry ---------- */
  const images = new Map(); // sha1hex -> {bytes, name}
  function sha1(buf) {
    return crypto.createHash('sha1').update(buf).digest();
  }
  function regImage(bytes, name) {
    const h = sha1(bytes);
    const hex = h.toString('hex');
    if (!images.has(hex)) images.set(hex, { bytes, name });
    return h;
  }
  function imgDims(buf) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; // png
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      // jpeg
      let i = 2;
      while (i < buf.length - 8) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
    return { w: 100, h: 100 };
  }

  /* ---------- paint / geometry helpers ---------- */
  const IDENT = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  function pos(i) {
    // fractional index position strings, strictly increasing
    const A = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}';
    if (i < A.length) return A[i];
    return A[Math.floor(i / A.length) - 1] + A[i % A.length];
  }
  function solid(c) {
    return {
      type: 'SOLID',
      color: { r: c.r, g: c.g, b: c.b, a: 1 },
      opacity: c.a != null ? c.a : 1,
      visible: true,
      blendMode: 'NORMAL',
    };
  }
  function gradientPaint(g) {
    // css angle: 0 = to top → d=(0,-1); 90 = to right; 180 = to bottom
    const th = (g.angle * Math.PI) / 180;
    const ddx = Math.sin(th),
      ddy = -Math.cos(th);
    const t = {
      m00: ddx,
      m01: ddy,
      m02: 0.5 - 0.5 * (ddx + ddy),
      m10: -ddy,
      m11: ddx,
      m12: 0.5 - 0.5 * (ddx - ddy),
    };
    return {
      type: 'GRADIENT_LINEAR',
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
      stops: g.stops.map(s => ({
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        position: s.position,
      })),
      transform: t,
    };
  }
  function imagePaint(bytes, name, scaleMode) {
    const h = regImage(bytes, name);
    const d = imgDims(bytes);
    return {
      type: 'IMAGE',
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
      transform: IDENT,
      image: { hash: h, name: name || '' },
      imageScaleMode: scaleMode || 'FILL',
      imageShouldColorManage: true,
      rotation: 0,
      scale: 0.5,
      originalImageWidth: d.w,
      originalImageHeight: d.h,
    };
  }
  function styleFromWeight(w, italic) {
    const map = {
      100: 'Thin',
      200: 'ExtraLight',
      300: 'Light',
      400: 'Regular',
      500: 'Medium',
      600: 'SemiBold',
      700: 'Bold',
      800: 'ExtraBold',
      900: 'Black',
    };
    const base = map[w] || 'Regular';
    if (!italic) return base;
    return base === 'Regular' ? 'Italic' : base + ' Italic';
  }

  /* ---------- document + canvas ---------- */
  const nodeChanges = [];
  const S = 1; // content sessionID
  let localCounter = 1;

  nodeChanges.push({
    guid: { sessionID: 0, localID: 0 },
    phase: 'CREATED',
    type: 'DOCUMENT',
    name: 'Document',
    visible: true,
    opacity: 1,
    transform: IDENT,
    strokeWeight: 0,
    strokeAlign: 'CENTER',
    strokeJoin: 'BEVEL',
  });
  nodeChanges.push({
    guid: { sessionID: 0, localID: 1 },
    phase: 'CREATED',
    type: 'CANVAS',
    name: M.canvasName || M.fileName || 'Prototype',
    parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
    visible: true,
    opacity: 1,
    transform: IDENT,
    strokeWeight: 0,
    strokeAlign: 'CENTER',
    strokeJoin: 'BEVEL',
    backgroundColor: BG,
    backgroundOpacity: 1,
    backgroundEnabled: true,
  });

  /* ---------- layout: rows top to bottom, frames left to right ---------- */
  const frameBox = f => JSON.parse(fs.readFileSync(f, 'utf8'))[0].rect;
  const pages = [];
  const canvasExtent = { w: 0, h: 0 };
  {
    let oy = 0;
    for (const row of M.rows || []) {
      let ox = 0,
        rowH = 0;
      for (const fr of row.frames || []) {
        const file = path.join(DUMPS, 'dump-' + fr.id + '.json');
        if (!fs.existsSync(file)) {
          deps.warn('  missing ' + path.basename(file) + ' — skipped');
          continue;
        }
        const r = frameBox(file);
        pages.push({ file, name: fr.name || fr.id, ox, oy });
        ox += r.w + GAP_X;
        if (r.h > rowH) rowH = r.h;
        if (ox - GAP_X > canvasExtent.w) canvasExtent.w = ox - GAP_X;
      }
      deps.log((row.label || 'row') + ' → ' + (ox ? Math.round(ox / 1000) + 'k px wide' : 'empty'));
      oy += rowH + GAP_Y;
      canvasExtent.h = oy - GAP_Y;
    }
  }
  if (!pages.length) {
    throw new GenerateFigError('no dumps found in ' + DUMPS + ' — run dump-frames.js first');
  }

  /* ---------- assets referenced from the page ---------- */
  const assetCache = new Map();
  function loadAsset(url) {
    const m = String(url).match(/([^/?"']+)(?:\?[^"']*)?$/);
    if (!m) return null;
    const p = path.join(ASSETS, m[1]);
    if (!assetCache.has(p)) {
      try {
        assetCache.set(p, fs.readFileSync(p));
      } catch (e) {
        assetCache.set(p, null);
      }
    }
    return assetCache.get(p) ? { bytes: assetCache.get(p), name: m[1] } : null;
  }

  /* ---------- emit one frame per dump ---------- */
  for (const page of pages) {
    const dump = JSON.parse(fs.readFileSync(page.file, 'utf8'));
    const byId = new Map(dump.map(n => [n.id, n]));
    const kids = new Map();
    for (const n of dump) {
      if (!kids.has(n.parent)) kids.set(n.parent, []);
      kids.get(n.parent).push(n.id);
    }
    const body = dump[0]; // body is always first
    const figIds = new Map();
    const childCounters = new Map();

    function guidFor(dumpId) {
      if (!figIds.has(dumpId)) figIds.set(dumpId, { sessionID: S, localID: localCounter++ });
      return figIds.get(dumpId);
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

    function emit(n, parentDumpId, parentRect, isRoot) {
      const g = guidFor(n.id);
      const parentGuid = isRoot ? { sessionID: 0, localID: 1 } : guidFor(parentDumpId);
      const idx = childCounters.get(parentDumpId ?? 'root') || 0;
      childCounters.set(parentDumpId ?? 'root', idx + 1);
      const relX = isRoot ? page.ox : n.rect.x - parentRect.x;
      const relY = isRoot ? page.oy || 0 : n.rect.y - parentRect.y;

      const node = {
        guid: g,
        phase: 'CREATED',
        parentIndex: { guid: parentGuid, position: pos(idx) },
        visible: true,
        opacity: n.opacity != null && !isRoot ? n.opacity : 1,
        transform: { ...IDENT, m02: relX, m12: relY },
        size: { x: Math.max(1, n.rect.w), y: Math.max(1, n.rect.h) },
        strokeWeight: 0,
        strokeAlign: 'INSIDE',
        strokeJoin: 'MITER',
      };

      if (n.type === 'text') {
        node.type = 'TEXT';
        node.name = (n.text || 'text').slice(0, 40);
        node.size = { x: Math.max(2, n.rect.w + 2), y: Math.max(2, n.rect.h) };
        node.fontSize = n.font.size;
        node.fontName = { family: n.font.family, style: styleFromWeight(n.font.weight, n.font.italic), postscript: '' };
        node.textData = {
          characters: n.text,
          lines: [
            {
              lineType: 'PLAIN',
              styleId: 0,
              indentationLevel: 0,
              sourceDirectionality: 'AUTO',
              listStartOffset: 0,
              isFirstLineOfList: false,
            },
          ],
        };
        node.lineHeight = { value: n.lineHeight, units: 'PIXELS' };
        if (n.letterSpacing) node.letterSpacing = { value: n.letterSpacing, units: 'PIXELS' };
        node.textAlignHorizontal =
          n.align === 'center'
            ? 'CENTER'
            : n.align === 'right' || n.align === 'end'
              ? 'RIGHT'
              : n.align === 'justify'
                ? 'JUSTIFIED'
                : 'LEFT';
        node.textAlignVertical = 'TOP';
        // single-line text keeps its own size so nothing re-wraps in Figma
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
        node.fillPaints = a ? [imagePaint(a.bytes, a.name, mode)] : [solid({ r: 0.8, g: 0.8, b: 0.8, a: 1 })];
        setRadius(node, n.radius);
        nodeChanges.push(node);
        return;
      }

      if (n.type === 'icon') {
        node.type = 'ROUNDED_RECTANGLE';
        node.name = 'icon';
        if (n.png) node.fillPaints = [imagePaint(Buffer.from(n.png.split(',')[1], 'base64'), 'icon.png', 'FILL')];
        else node.fillPaints = [];
        nodeChanges.push(node);
        return;
      }

      // box → FRAME
      node.type = 'FRAME';
      node.name = isRoot ? page.name : (n.name || 'div').slice(0, 40);
      if (!n.clips) node.frameMaskDisabled = true;
      const fills = [];
      if (n.bg) fills.push(solid(n.bg));
      if (n.gradient && n.gradient.stops.length >= 2) fills.push(gradientPaint(n.gradient));
      if (n.bgUrl) {
        const a = loadAsset(n.bgUrl);
        if (a) fills.push(imagePaint(a.bytes, a.name, n.bgSize === 'contain' ? 'FIT' : 'FILL'));
      }
      node.fillPaints = fills;
      setRadius(node, n.radius);

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
            node.borderTopWeight = ws[0];
            node.borderRightWeight = ws[1];
            node.borderBottomWeight = ws[2];
            node.borderLeftWeight = ws[3];
          }
        }
      }

      const effs = (n.shadows || []).map(s => ({
        type: s.inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        offset: { x: s.x, y: s.y },
        radius: s.blur,
        spread: s.spread || 0,
        visible: true,
        blendMode: 'NORMAL',
        showShadowBehindNode: false,
      }));
      if (effs.length) node.effects = effs;
      nodeChanges.push(node);

      for (const cid of kids.get(n.id) || []) emit(byId.get(cid), n.id, n.rect, false);
    }

    emit(body, null, body.rect, true);
    deps.log('  ' + page.name + ' → ' + nodeChanges.length + ' nodes so far');
  }

  /* ---------- encode ----------
   CRITICAL: the data chunk must be zstd. With deflate, Figma accepts the upload and
   then hangs forever at "0 of 1 files" with no error. The schema chunk stays
   deflate-raw and is passed through byte-for-byte. */
  const encoded = schema.encodeMessage({ type: 'NODE_CHANGES', sessionID: 0, ackID: 0, nodeChanges });
  deps.log('encoded message: ' + encoded.length + ' bytes, images: ' + images.size);

  const chunk1 = zlib.zstdCompressSync(Buffer.from(encoded));
  const u32 = n => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n);
    return b;
  };
  const header = Buffer.alloc(12);
  header.write('fig-kiwi', 0, 'latin1');
  header.writeUInt32LE(version, 8);
  const canvasFig = Buffer.concat([
    header,
    u32(chunk0raw.length),
    Buffer.from(chunk0raw),
    u32(chunk1.length),
    Buffer.from(chunk1),
  ]);

  /* ---------- assemble the zip ---------- */
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'figout-'));
  fs.mkdirSync(path.join(stage, 'images'), { recursive: true });
  fs.writeFileSync(path.join(stage, 'canvas.fig'), canvasFig);
  fs.writeFileSync(
    path.join(stage, 'meta.json'),
    JSON.stringify({
      client_meta: {
        background_color: BG,
        thumbnail_size: { width: 400, height: 225 },
        render_coordinates: { x: 0, y: 0, width: Math.ceil(canvasExtent.w), height: Math.ceil(canvasExtent.h) },
      },
      file_name: M.fileName || 'Prototype',
      developer_related_links: [],
      exported_at: deps.now().toISOString(),
    })
  );
  let thumbed = false;
  if (M.thumbnail) {
    const source = manifestPaths.thumbnail;
    try {
      // stderr is captured rather than inherited so a real sips failure can be quoted below.
      run(
        'sips',
        ['-Z', '400', source, '--out', path.join(stage, 'thumbnail.png')],
        { stdio: ['ignore', 'ignore', 'pipe'] },
        deps
      );
      thumbed = fs.existsSync(path.join(stage, 'thumbnail.png'));
    } catch (e) {
      // Two different failures used to look identical here. `sips` is macOS-only, so on
      // Linux it is simply absent (ENOENT) and the stub thumbnail is the expected result;
      // anything else is a real failure on a real binary and reads differently.
      if (e.code === 'ENOENT') {
        deps.warn(
          '  thumbnail: `sips` not found — it ships with macOS only. ' +
            'Using the stub thumbnail; the .fig is still valid.'
        );
      } else {
        const why = (e.stderr && e.stderr.toString().trim()) || e.message;
        deps.warn(
          '  thumbnail: sips failed on ' +
            source +
            ' — ' +
            why +
            '\n  Using the stub thumbnail; the .fig is still valid.'
        );
      }
    }
  }
  if (!thumbed) fs.writeFileSync(path.join(stage, 'thumbnail.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  for (const [hex, v] of images) fs.writeFileSync(path.join(stage, 'images', hex), v.bytes);
  // `outFig` is absolute (path.resolve, above), so running zip with `cwd: stage` — which
  // replaces the old `cd "${stage}" &&` — cannot change where the archive lands.
  //
  // zip writes to a same-directory temp path — pid + a random suffix, mirroring
  // dump-frames.js's job.out handling (IMPL-16) — and only a clean exit ever promotes it
  // onto outFig via rename. There is no pre-emptive delete of outFig any more: the old
  // `rmSync(outFig)` here meant an interruption mid-zip left a corrupt .fig at outFig with
  // the previous good copy already gone — worse than never touching outFig until the
  // replacement is actually ready. The temp file stays beside outFig rather than under
  // os.tmpdir(), because a rename across filesystems is not atomic.
  const tmpFig = outFig + '.tmp-' + deps.pid + '-' + deps.random().toString(36).slice(2, 8);
  const cleanupTmpFig = () => {
    try {
      fs.rmSync(tmpFig, { force: true });
    } catch (e) {
      /* nothing left to remove */
    }
  };
  try {
    run(
      'zip',
      ['-X', '-q', '-0', '-r', tmpFig, 'canvas.fig', 'meta.json', 'thumbnail.png', 'images'],
      { cwd: stage },
      deps
    );
    // This is the only line in this file that ever touches outFig.
    fs.renameSync(tmpFig, outFig);
  } catch (e) {
    // Covers a non-zero zip exit (execFileSync throws) and a failed rename alike — either
    // way the temp file is what's incomplete, never outFig.
    cleanupTmpFig();
    throw new GenerateFigError('.fig export failed: ' + e.message);
  }
  deps.log('wrote ' + outFig + ' — ' + fs.statSync(outFig).size + ' bytes, ' + pages.length + ' frames');
  return { output: outFig, frames: pages.length };
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (error instanceof GenerateFigError) {
      console.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}

module.exports = {
  GenerateFigError,
  createDependencies,
  main,
};
