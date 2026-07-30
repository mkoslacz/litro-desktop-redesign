#!/usr/bin/env python3
"""Turn the scraped production photos into the `assets/prod/` pack + its manifest.

    python3 tools/scrape-prod-assets.py --out /tmp/litro-raw      # download
    python3 tools/build-prod-assets.py  --raw /tmp/litro-raw      # convert + map

The prototype addresses every photo by slot name (`assets/room-double.jpg`), so the
pack mirrors those names: `assets/prod/<slot>.webp` is the production stand-in for
`assets/<slot>.jpg`, and `assets/prod/h/<hotel>/<slot>.webp` is the same slot for one
specific property. `prod-assets.js` does the swapping at runtime.

SLOTMAP below is a by-eye classification of the scraped galleries (index = the file
number under `raw/<hotel>/`). Re-scraping reshuffles those indexes, so if you pull the
galleries again, re-check the sheets (tools/../scratchpad sheets.py) before trusting it.
"""
import argparse, json, os, re, shutil, sys

try:
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow:  python3 -m pip install pillow")

SLOTS = ["aerial-hotel", "aerial-portrait", "apartment-family", "coastline", "jacuzzi-view",
         "lobby", "pool-rooftop", "pool-sunset", "room-double", "room-seaview", "spa-indoor"]

# hotel slug -> {slot: index of the file in raw/<slug>/}
SLOTMAP = {
    "mediteranean":  [15, 12,  2, 11,  7,  4, 14,  0,  6,  1, 10],
    "victoria":      [15, 14,  7, 13,  4,  8, 12,  0,  1,  5,  9],
    "sara-boutique": [15,  6,  8,  0,  5, 10, 11, 12,  3,  2,  4],
    "sonio":         [ 0, 11,  4, 10,  7,  9, 15, 12,  2,  3,  8],
    "mondial":       [15, 11,  3, 12,  6,  8, 13,  0,  1,  7, 10],
    "flora":         [ 9, 15,  6, 15,  5, 12,  0,  9,  1,  3, 14],
    "aurora":        [14, 15,  4,  8,  5, 11,  0,  9,  1,  2, 12],
    "phoenicia":     [ 0, 15,  1,  9,  6,  4, 12, 14,  8,  5, 10],
    "mera":          [ 0, 15,  6, 14,  5,  4, 13, 12,  1,  2,  8],
    "turquoise":     [14, 15,  4, 11,  5, 12,  7,  6,  1,  2, 13],
    "poseidon":      [13, 14,  2,  9,  4,  8, 15,  0,  1,  3, 12],
    "aqvatonic":     [15,  0,  4, 13, 12,  8, 11, 14,  1,  2,  9],
    "belvedere":     [ 0, 14,  8,  1,  4, 11, 15, 13,  2,  6,  5],
}

# the set used wherever no single property is implied — best-of, across properties
DEFAULT = {
    "aerial-hotel":     ("turquoise", 15),
    "aerial-portrait":  ("mediteranean", 12),
    "apartment-family": ("phoenicia", 3),
    "coastline":        ("turquoise", 11),
    "jacuzzi-view":     ("aqvatonic", 12),
    "lobby":            ("belvedere", 11),
    "pool-rooftop":     ("phoenicia", 0),
    "pool-sunset":      ("turquoise", 6),
    "room-double":      ("sonio", 2),
    "room-seaview":     ("sara-boutique", 2),
    "spa-indoor":       ("aqvatonic", 11),
}

# hotel names as the prototype writes them -> slug. Longest match wins at runtime.
HOTEL_NAMES = {
    "mediteranean": "mediteranean", "victoria": "victoria", "sara": "sara-boutique",
    "sonio": "sonio", "mondial": "mondial", "flora": "flora", "aurora": "aurora",
    "phoenicia": "phoenicia", "mera": "mera", "turquoise": "turquoise",
    "poseidon": "poseidon", "aqvatonic": "aqvatonic", "acvatonic": "aqvatonic",
    "belvedere": "belvedere",
}

# destination photos: production's own gallery images, keyed by how the prototype names them
RESORTS = {
    "mamaia-nord":   "2__Mamaia_Sat.jpg",
    "mamaia-sat":    "2__Mamaia_Sat.jpg",
    "mamaia":        "1__Mamaia__1652879203.jpg",
    "eforie-nord":   "3__Eforie_Nord__1652879729.jpg",
    "eforie-sud":    "4__Eforie_Sud.jpg",
    "costinesti":    "5__Costinesti.jpg",
    "neptun-olimp":  "6__Neptun-Olimp__1652879828.jpg",
    "jupiter":       "7__Jupiter__1652881226.jpg",
    "venus":         "8__Venus.jpg",
    "saturn":        "9__Saturn__1652879858.jpg",
    "mangalia":      "10__Mangalia.jpg",
    "constanta":     "11__Constanta.jpg",
    "vama-veche":    "12__Vama_Veche_2_Mai.jpg",
    "techirghiol":   "21__Techirghiol.jpg",
}
# the phrases those slugs answer to, on the page (lowercase, diacritics stripped)
RESORT_NAMES = {
    "mamaia nord": "mamaia-nord", "mamaia sat": "mamaia-sat", "mamaia": "mamaia",
    "eforie nord": "eforie-nord", "eforie sud": "eforie-sud", "eforie": "eforie-nord",
    "costinesti": "costinesti", "neptun": "neptun-olimp", "olimp": "neptun-olimp",
    "jupiter": "jupiter", "venus": "venus", "saturn": "saturn", "mangalia": "mangalia",
    "constanta": "constanta", "vama veche": "vama-veche", "techirghiol": "techirghiol",
}

# campaign creatives. `as` = the prototype file this one stands in for (name mirror),
# otherwise the banner only lands in the pack + the reference page.
BANNERS = [
    # „Super ofertele verii” (cardul fixat) e deja o creație de producție în prototip, deci
    # nu se schimbă la comutare — bannerul campaniei curente stă în pachet, ca alternativă.
    ("dektop1140x260.png",              None, "Bannerul de campanie curent, desktop (1140×260)"),
    ("mobile_856x260.png",              None, "Bannerul de campanie curent, mobil (856×260)"),
    ("Banner_ofertele_verii_adela_2_desktop.webp", None, "Super ofertele verii — desktop (deja în prototip)"),
    ("Banner_ofertele_verii_adela_2_mobile.webp",  None, "Super ofertele verii — mobil (deja în prototip)"),
    ("holidays_banner.png",             None, "Vacanțe fără griji — 6 rate fără dobândă"),
    ("holiday_vouchers.jpg",            None, "Acceptăm vouchere de vacanță"),
    ("friends_home_banner.png",         None, "Banda FRIENDS de pe prima pagină"),
    ("asigurare_storno_header.webp",    None, "Antetul paginii de asigurare storno"),
    ("backgr_newsletter.jpg",           None, "Fundalul casetei de newsletter"),
    ("adela_1.png",                     None, "Creație de campanie — Adela pe plajă"),
    ("adela_2.png",                     None, "Creație de campanie — Adela pe terasă"),
    ("adela_3.png",                     None, "Creație de campanie — Adela la piscină"),
    ("adela_all.png",                   None, "Creație de campanie — portret"),
    ("logo_campanie.png",               None, "Logo de campanie"),
    ("litoralulromanesc-logo.svg",      None, "Logo LITRO"),
    ("litoralulromanesc-logo-orizontal.svg", None, "Logo LITRO, orizontal"),
]

MAXPX, QUALITY = 1100, 72


def convert(src, dest, maxpx=MAXPX):
    """Re-encode to webp at a size the prototype can actually use."""
    if src.lower().endswith(".svg"):
        shutil.copyfile(src, dest)
        return os.path.getsize(dest)
    im = Image.open(src)
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
    if max(im.size) > maxpx:
        im.thumbnail((maxpx, maxpx), Image.LANCZOS)
    if im.mode == "RGBA":                      # webp keeps alpha, jpeg sources never have it
        im.save(dest, "WEBP", quality=QUALITY, method=5)
    else:
        im.save(dest, "WEBP", quality=QUALITY, method=5)
    return os.path.getsize(dest)


def raw_file(raw, slug, idx):
    d = os.path.join(raw, "hotels", slug)
    files = sorted(f for f in os.listdir(d) if f.lower().endswith((".webp", ".jpg", ".jpeg", ".png")))
    return os.path.join(d, files[idx])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, help="output dir of scrape-prod-assets.py")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "assets", "prod"))
    a = ap.parse_args()
    raw, out = a.raw, a.out

    for sub in ("", "h", "r", "banners"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    total = 0
    manifest = {"slots": SLOTS, "hotels": {}, "hotelNames": HOTEL_NAMES,
                "resorts": {}, "resortNames": RESORT_NAMES, "banners": [], "mirror": {}}

    # 1. default set
    for slot, (slug, idx) in DEFAULT.items():
        dest = os.path.join(out, slot + ".webp")
        total += convert(raw_file(raw, slug, idx), dest)
        manifest["mirror"][slot] = {"file": slot + ".webp", "from": f"{slug}/{idx:02d}"}
    print(f"default set: {len(DEFAULT)} files")

    # 2. per-property sets
    for slug, idxs in SLOTMAP.items():
        d = os.path.join(out, "h", slug)
        os.makedirs(d, exist_ok=True)
        got = []
        for slot, idx in zip(SLOTS, idxs):
            dest = os.path.join(d, slot + ".webp")
            total += convert(raw_file(raw, slug, idx), dest)
            got.append(slot)
        manifest["hotels"][slug] = got
        print(f"  {slug:14s} {len(got)} slots")

    # 3. destinations
    for slug, fn in RESORTS.items():
        src = os.path.join(raw, "resorts", fn)
        if not os.path.exists(src):
            print(f"  !! missing resort photo {fn}")
            continue
        dest = os.path.join(out, "r", slug + ".webp")
        total += convert(src, dest, maxpx=900)
        manifest["resorts"][slug] = "r/" + slug + ".webp"
    print(f"destinations: {len(manifest['resorts'])} files")

    # 4. campaign creatives
    for fn, mirrors, caption in BANNERS:
        src = os.path.join(raw, "banners", fn)
        if not os.path.exists(src) or os.path.getsize(src) == 0:
            print(f"  !! missing banner {fn}")
            continue
        base = re.sub(r"[^a-zA-Z0-9._-]", "-", fn)
        if fn.lower().endswith(".svg"):
            dest, name = os.path.join(out, "banners", base), "banners/" + base
            shutil.copyfile(src, dest)
            total += os.path.getsize(dest)
        else:
            name = "banners/" + os.path.splitext(base)[0] + ".webp"
            dest = os.path.join(out, name)
            total += convert(src, dest, maxpx=1400)
        manifest["banners"].append({"file": name, "caption": caption, "source": fn})
        if mirrors:                       # also stands in for a prototype asset by name
            mdest = os.path.join(out, mirrors)
            shutil.copyfile(dest, mdest)
            total += os.path.getsize(mdest)
            manifest["mirror"][os.path.splitext(mirrors)[0]] = {"file": mirrors, "from": fn}
    print(f"banners: {len(manifest['banners'])} files")

    js = os.path.join(out, "manifest.js")
    with open(js, "w", encoding="utf-8") as f:
        f.write("/* generated by tools/build-prod-assets.py — do not edit by hand */\n")
        f.write("window.LITRO_PROD_MANIFEST = " + json.dumps(manifest, ensure_ascii=False, indent=1) + ";\n")
    print(f"\n{out}  —  {total/1048576:.1f} MB, manifest -> {js}")


if __name__ == "__main__":
    main()
