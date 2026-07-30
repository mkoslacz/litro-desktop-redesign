#!/usr/bin/env python3
"""Contact sheets of a scraped raw dump — how SLOTMAP gets decided.

    python3 tools/scrape-prod-assets.py --out /tmp/litro-raw
    python3 tools/contact-sheets.py --raw /tmp/litro-raw --out /tmp/litro-sheets

One numbered sheet per property (plus one for the destinations and one for the creatives). The number
on each tile is the file name under `raw/hotels/<slug>/`, which is exactly the index `SLOTMAP` in
build-prod-assets.py refers to — so you look at the sheet, decide which frame is the double room and
which is the pool, and write the indexes down.
"""
import argparse, os, sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("needs Pillow:  python3 -m pip install pillow")


def sheet(files, dest, cols=4, tile=(300, 200)):
    if not files:
        return
    rows = (len(files) + cols - 1) // cols
    sh = Image.new("RGB", (cols * tile[0], rows * tile[1]), "#111")
    d = ImageDraw.Draw(sh)
    for i, f in enumerate(files):
        try:
            im = Image.open(f).convert("RGB")
        except Exception as e:
            print("  skip", os.path.basename(f), e)
            continue
        im.thumbnail(tile)
        x, y = (i % cols) * tile[0], (i // cols) * tile[1]
        sh.paste(im, (x + (tile[0] - im.width) // 2, y + (tile[1] - im.height) // 2))
        lbl = os.path.splitext(os.path.basename(f))[0]
        d.rectangle([x + 2, y + 2, x + 12 + 9 * len(lbl), y + 24], fill="#000")
        d.text((x + 7, y + 8), lbl, fill="#0f0")
    sh.save(dest, quality=80)
    print(dest, sh.size)


def files_in(d):
    return [os.path.join(d, f) for f in sorted(os.listdir(d))
            if f.lower().endswith((".webp", ".jpg", ".jpeg", ".png"))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    hotels = os.path.join(a.raw, "hotels")
    for slug in sorted(os.listdir(hotels)):
        d = os.path.join(hotels, slug)
        if os.path.isdir(d):
            sheet(files_in(d), os.path.join(a.out, slug + ".jpg"))
    for name, cols, tile in (("resorts", 6, (240, 170)), ("banners", 4, (360, 220))):
        d = os.path.join(a.raw, name)
        if os.path.isdir(d):
            sheet(files_in(d), os.path.join(a.out, "_" + name + ".jpg"), cols, tile)


if __name__ == "__main__":
    main()
