#!/usr/bin/env python3
"""Pull real photos and campaign creatives off the live litoralulromanesc.ro.

    python3 tools/scrape-prod-assets.py --out /tmp/litro-raw
    python3 tools/build-prod-assets.py  --raw /tmp/litro-raw

Writes `<out>/hotels/<slug>/NN.webp` (property galleries — the `big/` rendition,
1600px), `<out>/resorts/*.jpg` (destination photos from the site's own gallery) and
`<out>/banners/*` (campaign creatives). Everything is skipped if already on disk, so
re-running is cheap. The raw dump stays outside the repo — only the converted pack in
`assets/prod/` is committed.

The property list is the set of hotels the prototype names, so a card that says
"Complex Mediteranean" can show Complex Mediteranean's own production photos.
"""
import argparse, json, os, re, subprocess, time, urllib.parse

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
BASE = "https://www.litoralulromanesc.ro/"
PER_HOTEL = 16

HOTELS = [
    ("mediteranean",  "hotel_mediteranean_mamaia.htm"),
    ("victoria",      "mamaia_victoria.htm"),
    ("sara-boutique", "hotel_sara_boutique_mamaia.htm"),
    ("sonio",         "sonio_boutique_mamaia.htm"),
    ("mondial",       "hotel_mondial_eforie_nord.htm"),
    ("flora",         "mamaia_flora.htm"),
    ("aurora",        "mamaia_aurora.htm"),
    ("phoenicia",     "mamaiasat_phoenicia.htm"),
    ("mera",          "mera_sky_resort_venus.htm"),
    ("turquoise",     "hotel_turquoise_venus.htm"),
    ("poseidon",      "hotel_poseidon_resort_spa_jupiter.htm"),
    ("aqvatonic",     "hotel_acvatonic_steaua_de_mare_eforie_nord.htm"),
    ("belvedere",     "eforien_belvedere.htm"),
]

RESORT_PHOTOS = [
    "1__Mamaia__1652879203.jpg", "2__Mamaia_Sat.jpg", "3__Eforie_Nord__1652879729.jpg",
    "4__Eforie_Sud.jpg", "5__Costinesti.jpg", "6__Neptun-Olimp__1652879828.jpg",
    "7__Jupiter__1652881226.jpg", "8__Venus.jpg", "9__Saturn__1652879858.jpg",
    "10__Mangalia.jpg", "11__Constanta.jpg", "12__Vama_Veche_2_Mai.jpg", "21__Techirghiol.jpg",
]

BANNERS = [
    "assets/dist/images/header/dektop1140x260.png",
    "assets/dist/images/header/mobile_856x260.png",
    "assets/dist/images/header/Banner_ofertele_verii_adela_2_desktop.webp",
    "assets/dist/images/header/Banner_ofertele_verii_adela_2_mobile.webp",
    "assets/dist/images/temp/holidays_banner.png",
    "assets/dist/images/holiday_vouchers.jpg",
    "assets/dist/images/secondary_pages/friends_club/friends_home_banner.png",
    "assets/dist/images/secondary_pages/vacante_in_rate/asigurare_storno_header.webp",
    "assets/dist/images/secondary_pages/super_ofertele_verii/adela_1.png",
    "assets/dist/images/secondary_pages/super_ofertele_verii/adela_2.png",
    "assets/dist/images/secondary_pages/super_ofertele_verii/adela_3.png",
    "assets/dist/images/secondary_pages/super_ofertele_verii/adela_all.png",
    "assets/dist/images/secondary_pages/logo_campanie.png",
    "assets/dist/images/litoralulromanesc-logo.svg",
    "assets/dist/images/litoralulromanesc-logo-orizontal.svg",
    "assets/dist/_/_/_/nfs_shared/app/src_images/backgr_newsletter.jpg",
]


def curl(url, dest=None):
    """curl rather than urllib — the stock python here has no CA bundle."""
    cmd = ["curl", "-sSL", "--fail", "-A", UA, "-e", BASE, urllib.parse.quote(url, safe=":/?&=%")]
    if dest:
        cmd += ["-o", dest]
    p = subprocess.run(cmd, capture_output=True, timeout=120)
    if p.returncode:
        if dest and os.path.exists(dest):
            os.remove(dest)
        raise RuntimeError(p.stderr.decode()[:160] or f"curl exit {p.returncode}")
    return p.stdout


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest):
        return True
    try:
        curl(url, dest)
        time.sleep(0.2)
        return True
    except Exception as e:
        print(f"   !! {url.rsplit('/', 1)[-1]}: {e}")
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = a.out
    for sub in ("hotels", "resorts", "banners"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    log = {}

    for slug, page in HOTELS:
        d = os.path.join(out, "hotels", slug)
        os.makedirs(d, exist_ok=True)
        try:
            html = curl(BASE + page).decode("utf-8", "replace")
        except Exception as e:
            print(f"!! {slug}: {e}")
            continue
        urls = list(dict.fromkeys(re.findall(
            r'"(https://www\.litoralulromanesc\.ro/assets/uploads/hoteluri/big/[^"]+)"', html)))
        if not urls:
            urls = list(dict.fromkeys(re.findall(
                r'"(https://www\.litoralulromanesc\.ro/assets/uploads/hoteluri/original/412x276/[^"]+)"', html)))
        # spread the pick over the whole gallery — the first frames are all façade shots
        pick = urls[:PER_HOTEL] if len(urls) <= PER_HOTEL else [
            urls[round(i * (len(urls) - 1) / (PER_HOTEL - 1))] for i in range(PER_HOTEL)]
        pick = list(dict.fromkeys(pick))
        n = 0
        for i, u in enumerate(pick):
            ext = os.path.splitext(urllib.parse.urlparse(u).path)[1] or ".webp"
            n += fetch(u, os.path.join(d, f"{i:02d}{ext}"))
        log[slug] = {"page": page, "gallery": len(urls), "saved": n}
        print(f"{slug:14s} gallery={len(urls):3d} saved={n}")

    for fn in RESORT_PHOTOS:
        fetch(BASE + "assets/uploads/galerie imagini/original/" + fn,
              os.path.join(out, "resorts", fn))
    print(f"resorts: {len(os.listdir(os.path.join(out, 'resorts')))} files")

    for b in BANNERS:
        fetch(BASE + b, os.path.join(out, "banners", b.rsplit("/", 1)[1]))
    print(f"banners: {len(os.listdir(os.path.join(out, 'banners')))} files")

    json.dump(log, open(os.path.join(out, "scrape-log.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
