# .fig extraction tools

Pipeline used to read the two Figma files in this folder without Figma access:

1. `.fig` is a ZIP → unzip to get `canvas.fig` (binary) + `images/` (all raster assets, sha1-named).
2. `node decode.js <dir> [depth]` — decodes `canvas.fig` (fig-kiwi format, zstd-compressed chunks; needs Node ≥22 for `zlib.zstdDecompressSync`, plus `npm i kiwi-schema pako`). Outputs `nodes.jsonl` (one node per line, image hashes as hex = filenames in `images/`) and `tree.txt` (page/frame tree with node ids).
3. `node inspect.js <dir>` — fonts, color histogram, design variables/tokens.
4. `node render.js <dir> <frameId>...` — renders a frame to standalone HTML in `<dir>/render/` (handles component instances via overrideKey-based guidPath matching, text/prop overrides, symbol swaps). Good enough to read the designs; not pixel-perfect (vector icons = blobs).

Gotcha: split `nodes.jsonl` only on raw `\n` bytes — text content contains chars that break `readline`.

Key frame ids — Szallas sandbox: Home 1:4509, Listing 1:20929, Accommodation 1:29364; Hotely re-skin: 2824:46247 / 2824:47117 / 2824:50339; Header cases canvas "Header". LITRO: live desktop captures 12:350 / 12:132 / 95:669, mobile redesign 224:4131 / 188:223 / 733:23120.
