#!/usr/bin/env node
/* Serwer statyczny prototypu (katalog desktop-redesign jako root).
   Każda odpowiedź idzie z Cache-Control: no-store — panel podglądu trzymał
   proto.js i proto.css w pamięci między odświeżeniami (lekcja z rund 8–9),
   przez co testowało się starą wersję skryptu.
     node tools/serve.js          → http://localhost:8080/
     PORT=3000 node tools/serve.js */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.fig': 'application/octet-stream',
};

const send = (res, code, msg) => {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(msg);
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found: ' + url);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log('prototyp na http://localhost:' + PORT + '/  (root: ' + ROOT + ')'));
