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

1. `node dump-dom.js <fileUrl> out.json` — drives headless Chrome and dumps an absolute-positioned visual tree
   (geometry, fills, gradients, borders, shadows, radii, text runs with real fonts, SVG icons rasterised at 3×,
   `::before`/`::after` overlays).
2. `node generate-fig.js out.fig` — encodes those trees as `NODE_CHANGES` using a schema copied **verbatim** from
   a real LITRO export, then zips `canvas.fig` + `images/` + `meta.json` + `thumbnail.png`.

**Critical:** the data chunk must be **zstd**-compressed. With deflate, Figma's importer accepts the file and then
hangs forever at "0 of 1 files" with no error. The schema chunk stays deflate-raw (copied byte-for-byte).

Single-line texts are exported with `textAutoResize: WIDTH_AND_HEIGHT` so nothing re-wraps in Figma.

**Importing:** drag the `.fig` onto the Figma home screen. The first open right after an import sometimes sticks
on the loading bar — one reload fixes it.

## Capturing the live site

`node dump-live.js` — renders the production pages (home / search results / hotel with the booking form) and
saves `innerText` plus full-page screenshots into `research/live-dumps/`. `extract.py` does the same for raw
curl'd HTML when JS isn't needed.

## Frame ids worth knowing

- **Szallas "Redesign sandbox":** Home `1:4509`, Listing `1:20929`, Accommodation `1:29364`;
  Hotely.cz re-skin `2824:46247` / `2824:47117` / `2824:50339`; header cases on the "Header" canvas.
- **"🟠 LITRO Master Pages":** live desktop captures `12:350` / `12:132` / `95:669`,
  mobile redesign `224:4131` / `188:223` / `733:23120`.
