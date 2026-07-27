#!/bin/bash
# Zrzuca wszystkie ramki do pliku „final" (desktop + mobile + warianty stanów).
# Każdy zrzut idzie z ?nopanel=1 (tryb eksportu: bez panelu demo, belki w flow).
# Uruchamiać z katalogu desktop-redesign:  bash tools/dump-all.sh
set -u
cd "$(dirname "$0")/.."
BASE="file://$PWD"
JOBS=3

dump() {  # dump <plik-wyjściowy> <strona+parametry> <szerokość>
  local out="tools/dump-$1.json" page="$2" w="$3"
  local sep='?'; [[ "$page" == *'?'* ]] && sep='&'
  node tools/dump-dom.js "$BASE/$page${sep}nopanel=1" "$out" "$w" >/dev/null 2>&1 \
    && echo "  ok   $1" || echo "  FAIL $1"
}

run() { dump "$@" & while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do wait -n; done; }

echo "desktop — flux principal (RO)"
run home-c            home-c.html            1440
run home-d            home-d.html            1440
run listing-c         listing-c.html         1440
run hotel             hotel.html             1440
run checkout          checkout.html          1440
run thankyou          thankyou.html          1440

echo "desktop — main flow (EN)"
run home-c-en         home-c-en.html         1440
run home-d-en         home-d-en.html         1440
run listing-c-en      listing-c-en.html      1440
run hotel-en          hotel-en.html          1440
run checkout-en       checkout-en.html       1440
run thankyou-en       thankyou-en.html       1440

echo "desktop — stări (densitate / cont)"
run listing-c-denb    'listing-c.html?density=b'   1440
run listing-c-denc    'listing-c.html?density=c'   1440
run listing-c-member  'listing-c.html?auth=in'     1440
run home-c-member     'home-c.html?auth=in'        1440

echo "desktop — arhivă A / B"
run home-a            home.html              1440
run home-b            home-b.html            1440
run listing-a         listing.html           1440
run listing-b         listing-b.html         1440

echo "mobile — flux principal (RO)"
run m-home            m-home.html            430
run m-listing         m-listing.html         430
run m-hotel           m-hotel.html           430
run m-checkout        m-checkout.html        430
run m-thankyou        m-thankyou.html        430

echo "mobile — main flow (EN)"
run m-home-en         m-home-en.html         430
run m-listing-en      m-listing-en.html      430
run m-hotel-en        m-hotel-en.html        430
run m-checkout-en     m-checkout-en.html     430
run m-thankyou-en     m-thankyou-en.html     430

echo "mobile — stări"
run m-listing-denb    'm-listing.html?density=b'   430
run m-listing-denc    'm-listing.html?density=c'   430
run m-listing-member  'm-listing.html?auth=in'     430
run m-listing-few     'm-listing.html?inv=few'     430
run m-hotel-room      'm-hotel.html?room=2'        430

wait
echo "gotowe: $(ls tools/dump-*.json | wc -l | tr -d ' ') zrzutów"
