# Tools — the .fig ↔ HTML pipeline

Everything here runs on plain Node (≥22, for `zlib.zstd*`) plus `npm i kiwi-schema pako puppeteer-core`.

## Reading a `.fig` file (no Figma account needed)

A `.fig` is a ZIP: `canvas.fig` (binary) + `images/` (raster assets, sha1-named) + `meta.json`.

1. `unzip file.fig -d dir/`
2. `node decode.js dir/ [depth]` — decodes `canvas.fig`. Format is **fig-kiwi**: 8-byte magic, uint32 version,
   then length-prefixed chunks — chunk 0 is the kiwi schema (deflate-raw), chunk 1 is the message (**zstd**).
   Writes `dir/nodes.jsonl` (one node per line; image hashes as hex = filenames under `images/`) and
   `dir/tree.txt` (page/frame tree with node ids).
3. `node inspect.js dir/` — fonts, colour histogram, design variables/tokens.
4. `node render.js dir/ <frameId>...` — renders frames to standalone HTML in `dir/render/`. Handles component
   instances properly: override matching is by **`overrideKey`-based guidPath**, walking the chain of instance
   boundaries (not the raw node tree), with outermost overrides winning.

**Gotcha:** split `nodes.jsonl` only on raw `\n` bytes. Figma text content contains characters that make
Node's `readline` split lines in the wrong place.

## Writing a `.fig` file (HTML → Figma)

1. `node dump-dom.js <fileUrl> out.json [viewportWidth]` — drives headless Chrome and dumps an absolute-positioned visual tree
   (geometry, fills, gradients, borders, shadows, radii, text runs with real fonts, SVG icons rasterised at 3×,
   `::before`/`::after` overlays).
2. `node generate-fig.js out.fig` — encodes those trees as `NODE_CHANGES` using a schema copied **verbatim** from
   a real LITRO export, then zips `canvas.fig` + `images/` + `meta.json` + `thumbnail.png`.

**Critical:** the data chunk must be **zstd**-compressed. With deflate, Figma's importer accepts the file and then
hangs forever at "0 of 1 files" with no error. The schema chunk stays deflate-raw (copied byte-for-byte).

**Mobile export:** `generate-fig-m.js` is the 430px variant — it reads `dump-m-*.json` and lays the frames out in
two rows (Romanian on top, English below, via the `oy` field). Dump the mobile pages with the width argument and
with `?nopanel=1`:

```
node dump-dom.js "file://$PWD/m-home.html?nopanel=1" tools/dump-m-home.json 430
node generate-fig-m.js litro-mobile-web.fig
```

`?nopanel=1` puts the prototype in **export mode**: the floating demo panel is not built, and the fixed bottom bars
join the normal flow. Without it the bars are captured at the bottom edge of the 1200px capture window, which lands
in the middle of a 4700px frame.

Single-line texts are exported with `textAutoResize: WIDTH_AND_HEIGHT` so nothing re-wraps in Figma.

**Importing:** drag the `.fig` onto the Figma home screen. The first open right after an import sometimes sticks
on the loading bar — one reload fixes it.

## Serving the prototype

`node tools/serve.js` puts `desktop-redesign/` on http://localhost:8080 (`PORT=3000 node tools/serve.js` to move it).
Every response carries `Cache-Control: no-store`, which is the whole point: over `file://` — and behind a caching
server — the preview pane keeps an old `proto.js`/`proto.css` in memory, so you end up testing the previous build
and inventing cache-busting tricks. `.claude/launch.json` starts this same server, so the in-app preview uses it too.

## Preview renders for the hub

`node shoot-previews.js [name ...]` refreshes the `preview-*.png` files that `index.html` shows — full-page shots at
1440px (desktop) and 500px (mobile, so the 430px app frame keeps its outer margin), all in `?nopanel=1` export mode.
Without an argument it redoes all sixteen; pass names (`node shoot-previews.js hotel m-hotel`) for just a few.
Run it after any change that touches every screen — a header or footer edit makes the whole set stale at once.

## Capturing the live site

`node dump-live.js` — renders the production pages (home / search results / hotel with the booking form) and
saves `innerText` plus full-page screenshots into `research/live-dumps/`. `extract.py` does the same for raw
curl'd HTML when JS isn't needed.

## The production photo pack

`python3 scrape-prod-assets.py --out /tmp/litro-raw` pulls the real photos off the live site: the `big/`
(1600px) gallery rendition for each of the 13 properties the prototype names, the destination photos from
`galerie imagini/original/`, and the campaign creatives under `dist/images/`. Downloads are skipped when the
file is already there, so re-running is cheap. Needs `curl` — the stock python here has no CA bundle.

`python3 build-prod-assets.py --raw /tmp/litro-raw` converts them into `../assets/prod/` (webp, ≤1100px)
and writes `assets/prod/manifest.js`, which `prod-assets.js` reads at runtime. The pack mirrors the
prototype's own file names — `assets/room-double.jpg` → `assets/prod/room-double.webp` — so the swap is a
pure path substitution and the gallery's category map (keyed by file name) keeps working.

`SLOTMAP` at the top of the build script maps each property's gallery **by index** onto the eleven photo
slots, and it is a by-eye classification — production file names are just `<hotel id>__<name>_<timestamp>`
and the alt text is the same sentence on every frame, so nothing but looking at them works. Regenerate the
numbered sheets with `python3 contact-sheets.py --raw /tmp/litro-raw --out /tmp/litro-sheets`: the number on
each tile is the index `SLOTMAP` uses. A fresh scrape can reshuffle those indexes, so re-check before
trusting the map. The raw dump is deliberately kept outside the repo; only the converted 13 MB pack is
committed.

## Frame ids worth knowing

- **Szallas "Redesign sandbox":** Home `1:4509`, Listing `1:20929`, Accommodation `1:29364`;
  Hotely.cz re-skin `2824:46247` / `2824:47117` / `2824:50339`; header cases on the "Header" canvas.
- **"🟠 LITRO Master Pages":** live desktop captures `12:350` / `12:132` / `95:669`,
  mobile redesign `224:4131` / `188:223` / `733:23120`.
