// Decode a Figma canvas.fig (kiwi format) into JSONL nodes + tree summary
const fs = require('fs');
const path = require('path');
const pako = require('pako');
const { decodeBinarySchema, compileSchema } = require('kiwi-schema');

const dir = process.argv[2]; // dir containing canvas.fig
const buf = fs.readFileSync(path.join(dir, 'canvas.fig'));

const magic = buf.subarray(0, 8).toString('latin1');
if (!magic.startsWith('fig-')) throw new Error('bad magic: ' + magic);
let off = 8;
const version = buf.readUInt32LE(off); off += 4;
const chunks = [];
while (off + 4 <= buf.length) {
  const len = buf.readUInt32LE(off); off += 4;
  chunks.push(buf.subarray(off, off + len)); off += len;
}
console.log('magic', JSON.stringify(magic), 'version', version, 'chunks', chunks.map(c => c.length));

const zlib = require('zlib');
function inflate(b) {
  try { return pako.inflateRaw(b); } catch (e) {}
  try { return pako.inflate(b); } catch (e) {}
  try { return new Uint8Array(zlib.zstdDecompressSync(b)); } catch (e) { console.error('zstd fail:', e.message); }
  return null;
}
const schemaBytes = inflate(chunks[0]);
const dataBytes = inflate(chunks[1]);
if (!schemaBytes || !dataBytes) throw new Error('inflate failed — maybe zstd');

const schema = compileSchema(decodeBinarySchema(schemaBytes));
const msg = schema.decodeMessage(dataBytes);
console.log('message keys:', Object.keys(msg));
console.log('nodeChanges:', msg.nodeChanges ? msg.nodeChanges.length : 0, 'blobs:', msg.blobs ? msg.blobs.length : 0);

// hex helper for Uint8Array (image hashes)
const toHex = (u8) => Buffer.from(u8).toString('hex');

function sanitize(v, key) {
  if (v instanceof Uint8Array) {
    if (v.length === 20) return toHex(v); // sha1 image hash
    return `<bytes:${v.length}>`;
  }
  if (Array.isArray(v)) return v.map(x => sanitize(x, key));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) {
      if (k === 'vectorData' || k === 'commandsBlob') { o[k] = '<geo>'; continue; }
      o[k] = sanitize(v[k], k);
    }
    return o;
  }
  return v;
}

const gid = g => g ? `${g.sessionID}:${g.localID}` : null;

// write JSONL of sanitized nodes
const out = fs.createWriteStream(path.join(dir, 'nodes.jsonl'));
const byId = new Map();
const children = new Map();
for (const n of msg.nodeChanges) {
  const id = gid(n.guid);
  byId.set(id, n);
  const p = n.parentIndex ? gid(n.parentIndex.guid) : null;
  if (p) {
    if (!children.has(p)) children.set(p, []);
    children.get(p).push({ id, pos: n.parentIndex.position });
  }
  const s = sanitize(n);
  s._id = id; s._parent = p;
  out.write(JSON.stringify(s) + '\n');
}
out.end();

// sort children by fractional index position
for (const arr of children.values()) arr.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));

// tree summary to depth N
const lines = [];
function walk(id, depth, maxDepth) {
  const n = byId.get(id);
  if (!n) return;
  if (n.visible === false) return;
  const size = n.size ? `${Math.round(n.size.x)}x${Math.round(n.size.y)}` : '';
  const t = n.type || '?';
  if (depth >= 0) lines.push(`${'  '.repeat(depth)}[${t}] ${JSON.stringify(n.name || '')} ${size} id=${id}`);
  if (depth >= maxDepth) return;
  // skip descending into instances/symbols at deep levels to keep output sane
  for (const c of (children.get(id) || [])) walk(c.id, depth + 1, maxDepth);
}
// find roots (DOCUMENT)
const roots = msg.nodeChanges.filter(n => !n.parentIndex).map(n => gid(n.guid));
for (const r of roots) {
  const rn = byId.get(r);
  lines.push(`ROOT [${rn.type}] ${rn.name || ''} id=${r}`);
  for (const c of (children.get(r) || [])) walk(c.id, 0, parseInt(process.argv[3] || '1', 10));
}
fs.writeFileSync(path.join(dir, 'tree.txt'), lines.join('\n'));
console.log('tree lines:', lines.length, '-> tree.txt, nodes.jsonl');
