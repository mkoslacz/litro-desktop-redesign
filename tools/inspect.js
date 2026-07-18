// Inspect nodes.jsonl: instance children?, fonts, colors, sample node props
const fs = require('fs');

const dir = process.argv[2];
// split ONLY on raw \n bytes — figma text contains chars that confuse readline
function* jsonlLines(path) {
  const buf = fs.readFileSync(path);
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 10) {
      if (i > start) yield buf.subarray(start, i).toString('utf8');
      start = i + 1;
    }
  }
}

const byId = new Map();
(async () => {
  for (const line of jsonlLines(dir + '/nodes.jsonl')) {
    const n = JSON.parse(line);
    byId.set(n._id, n);
  }
  const types = {};
  const fonts = {};
  const colors = {};
  let instWithKids = 0, instTotal = 0;
  const kids = new Map();
  for (const n of byId.values()) {
    types[n.type] = (types[n.type] || 0) + 1;
    if (n._parent) { kids.set(n._parent, (kids.get(n._parent) || 0) + 1); }
  }
  for (const n of byId.values()) {
    if (n.type === 'INSTANCE') { instTotal++; if (kids.get(n._id)) instWithKids++; }
    if (n.fontName) { const f = `${n.fontName.family} / ${n.fontName.style}`; fonts[f] = (fonts[f] || 0) + 1; }
    for (const p of (n.fillPaints || [])) {
      if (p.type === 'SOLID' && p.color && (p.visible !== false)) {
        const c = p.color;
        const hex = '#' + [c.r, c.g, c.b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
        colors[hex] = (colors[hex] || 0) + 1;
      }
    }
  }
  console.log('== types ==');
  console.log(Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
  console.log(`== instances: ${instTotal}, with children in tree: ${instWithKids}`);
  console.log('== fonts ==');
  for (const [f, c] of Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${c}\t${f}`);
  console.log('== top solid colors ==');
  for (const [f, c] of Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${c}\t${f}`);
  // sample a TEXT node and a FRAME with autolayout, and an INSTANCE
  const sample = (pred, label) => {
    for (const n of byId.values()) if (pred(n)) { console.log(`== sample ${label} ==`); console.log(JSON.stringify(n).slice(0, 1500)); return; }
  };
  sample(n => n.type === 'TEXT' && n.characters && n.characters.length > 5, 'TEXT');
  sample(n => n.type === 'INSTANCE', 'INSTANCE');
  sample(n => n.type === 'FRAME' && n.stackMode && n.stackMode !== 'NONE', 'AUTOLAYOUT FRAME');
  sample(n => (n.fillPaints || []).some(p => p.type === 'IMAGE'), 'IMAGE FILL');
})();
