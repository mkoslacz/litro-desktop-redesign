# LITRO desktop redesign

Desktop redesign for **litoralulromanesc.ro**, built on the approved Szallas Group design system
(the "Redesign sandbox" Figma file) with a LITRO brand skin — the same move as the Hotely.cz re-skin
inside that sandbox.

**Live preview:** https://mateuszkoslacz.com/litro-desktop-redesign/
**Figma (current):** [LITRO Desktop Redesign v2 — audit fixes](https://www.figma.com/design/OGgGMDJ03m615HJ0X6Wfvu)

## What's here

| Path | What |
|---|---|
| `index.html` | Overview page — screens, brand mapping, handoff instructions |
| `home.html` `listing.html` `hotel.html` `checkout.html` `thankyou.html` | The five 1440px desktop screens |
| `m-home.html` `m-listing.html` `m-hotel.html` `m-checkout.html` `m-thankyou.html` (+ `-en`) | The same flow as **mobile web**, at 390px, in Romanian and English |
| `litro.css` | The design system: colour/radius/shadow/type tokens + every component |
| `litro-m.css` `proto-m.js` | Mobile stylesheet + mobile interaction engine (see below) |
| `litro-final.fig` | **The handoff file** — 38 editable frames: desktop + mobile, RO + EN, plus every state variant. Generated from `prototype.json`; never hand-edited |
| `prototype.json` | Declares every exported frame — a page plus the query params that pin its state. A new state is a line here, not an edited script |
| `changelog.json` | Generated from Git by `tools/build-changelog.js`; read in the panel's *Jurnal de modificări* sheet |
| `usecases.json` | **Hand-written source**: what every demo state means, plus ten declared product situations |
| `usecases.built.json` `docs/usecases.md` `docs/usecases/` | Generated from it — panel payload, developer documentation, and one capture per use-case screen |
| `proto-sheets.js` `proto-sheets.css` | The two read-only panel sheets (changelog + use cases), shared by the desktop and mobile engines |
| `proto-comments.js` `proto-comments.css` `proto-comments-boot.js` | Stakeholder comment layer — pins, threads, replies, resolve. Dormant until `comments.config.json` exists |
| `comments.config.example.json` `comments.config.schema.json` `comments.rules` | Comment-layer configuration contract and the Firestore security rules to deploy |
| `litro-mobile-web.fig` `litro-desktop-redesign.fig` `litro-c-flow-en.fig` | Earlier partial exports, superseded by `litro-final.fig` |
| `specs.html` | Measurement spec for developers (component by component, all values in px) |
| `audit.html` | Production gap audit — live funnel vs these screens + call-centre strategy |
| `preview-*.png` | Full-page renders of each screen |
| `litro-desktop-redesign.fig` | Native Figma file with all five screens as editable frames |
| `assets/` | Photos used in the mockups (placeholders taken from the Szallas sandbox) |
| `assets/prod/` | The **production** photo pack scraped off the live site + `manifest.js` (generated) |
| `prod-assets.js` | Runtime that swaps the prototype's photos for the production ones (panel row *Photos*) |
| `prod-assets.html` | Catalogue of the production pack — creatives, default set, resorts, per-hotel sets |
| `tools/` | The pipeline that made all this possible — see `tools/README.md` |
| `research/live-dumps/` | Captures of the live production site (18–19 Jul 2026) that the audit is based on |
| `research/audit-data/` | Raw gap findings, adversarial verdicts and the live feature inventory |

## Brand skin

Szallas DS layout, spacing and typography (Outfit + DM Sans) are kept as-is. LITRO colours follow the
already-approved LITRO **mobile** redesign: navy `#004B97` for brand, links, rating badges and prices;
orange `#EB802D` for CTAs and stars; red discount pills and green perks unchanged from the DS.

## Mobile web

`m-*.html` is the same C flow — home → listing → hotel → checkout → confirmation — rebuilt for a
390px viewport (the width of the `Mobile (REDESIGN)` frames in *🟠 LITRO Master Pages*). It reuses the
patterns the LITRO team already approved on mobile: navy app bar, the white search-summary card with an
orange border, the **Filtre · Sortare · Hartă** row, the 3-step checkout stepper and the editable advance.

- `litro-m.css` repeats the **same `:root` token block** as `litro.css` (that file stays the source of
  truth) and then defines only mobile components — fixed bars, bottom sheets, one-column cards.
- `proto-m.js` is a separate engine, but it shares the `litro` localStorage key and the **same price
  model** as `proto.js`, so destination / dates / guests carry across desktop and mobile and both price
  a stay identically. Desktop files are untouched.
- Mobile-only interaction: search, calendar, guests, filters and sort open as full-screen sheets; the
  hotel gallery is swipeable and opens into the same two-step mosaic; the booking bar slides up from the
  bottom after the first room is added;
  checkout keeps a fixed bar with the amount due today.
- The page column is capped at 430px and centred above 460px viewport width, so the screens can be
  reviewed in a desktop browser without a device.

### The floating "Prototype · settings" panel

Demo switches never belong in the product UI, so they live in one floating panel — bottom right on
mobile, and on desktop in a left-hand rail that also holds the "Demo inventory" box. The rail is one
column with its own internal scroll, so the panel can never be clipped by the bottom of the window
however many switches it grows, and the `–` button collapses it to a `⚙ Prototip` pill in the corner
when it would sit over the page. Both the collapsed state and every switch survive a page change.

| Row | What it does |
|---|---|
| Language | RO ↔ EN, carrying destination and dates in the URL |
| View | Desktop ↔ Mobile — the only way to reach the phone screens from a full-size browser window, and back |
| Account | Guest ↔ Member (hides the "sign in for FRIENDS" bands) |
| Session *(hotel)* | A visitor arriving cold vs one who came from our own listing |
| Card view *(listing)* | A detailed · B compact with the date/board/room icon row · C horizontal summary |
| Results per page *(listing)* | 10 / 20 / 30 — changes both how many cards the list shows and the pager under it |
| Filter column *(listing)* | Sticky — from the map down the filters stay in view and scroll on their own, separately from the results — or flowing with the page |
| Demo inventory *(listing)* | Many / Some / Few results — drives the count, the empty state and the flexible-date banner |
| Photos | Prototype ↔ **Production** — every photo swaps to the real one from the live site (see below) |
| Sticky search bar | Three independent switches (homepage / listing / hotel); the row for the page you are on is marked |
| Pinned card *(carousels)* | No pinned card · pinned as the first card in the row · pinned as a wide band above |

Every one of these is also settable from the URL, on both desktop and mobile, so any state can be
linked to directly — and so the Figma export can capture each variant without a click:

| Param | Effect |
|---|---|
| `?auth=in` / `?auth=out` | Member vs guest (hides the "sign in for FRIENDS" bands) |
| `?density=a\|b\|c` | Listing card density |
| `?inv=many\|some\|few` | Demo inventory (mobile listing) |
| `?room=2` | Pre-selects rooms so the booking bar is up (mobile hotel) |
| `?f=own` | Enter the listing with filters already applied (comma-separated keys; clears the page's presets first) |
| `?rooms=on\|off` | Show or hide the "see all room types" expander on listing cards |
| `?session=new\|site` | Hotel page: a visitor arriving cold (search bar on top) vs one who came from a listing |
| `?sthome=`, `?stlist=`, `?sthotel=` `on\|off` | Sticky search bar, per page type |
| `?pin=off\|inline\|banner` | The pinned campaign card on a carousel |
| `?stf=on\|off` | Sticky filter column, scrolled separately from the results |
| `?assets=prod\|proto` | Production photos vs the prototype's own (remembered, so it survives the next click) |
| `?per=10\|20\|30` | Results per page — the list and the pager follow it together |
| `?nopanel=1` | Export mode: no demo panel, fixed bars join the normal flow, filter column back in the page flow |

## Production photos — the "Fotografii: Producție" switch

The prototype ships with clean stock photography, which flatters the layout. The **Photos** row in the
demo panel swaps every image on the page for the real one from **litoralulromanesc.ro**, so the design
can be judged on the photo base we actually have — inconsistent crops, portrait phone shots, campaign
badges burned into the JPEG, hotels with no spa photo at all. Nothing else changes: same copy, same
prices, same behaviour. `prod-assets.html` is the catalogue of everything in the pack.

Where each photo lands:

- **a hotel card or the hotel page** → that property's own production photos. The name is read from the
  card (`.lcard`, `.hcard`, `.pick`, `.hc-hotel`) or from `.hp-title`, so "Complex Mediteranean" shows
  Complex Mediteranean. All 13 properties the prototype names by hand exist in production.
- **a destination card** (`.near-card`, `.mz`, `.prev-card`) → that resort's photo from the site's own
  destination gallery.
- **everything else** — hero, carousel, inspiration tiles → a default set picked across properties.
- **the pinned campaign card is left alone**: "Super ofertele verii" is already a production creative.
  The current campaign banner and the other creatives (6 rate, vouchere de vacanță, FRIENDS, storno,
  Adela, newsletter background, logos) sit in `assets/prod/banners/` unused — the layout has no slot
  for them yet.

How it works — `prod-assets.js` sets **`srcset`**, it never rewrites `src`. Everything in `proto.js` /
`proto-m.js` that reads or writes `src` (card galleries, the lightbox, the gallery category map keyed
by file name) keeps working on the prototype's own file names, and the browser renders the production
candidate. A `MutationObserver` catches images injected later and any `src` change. `?assets=` is read
at **script parse time**, not at `DOMContentLoaded` — the prototype rewrites its own URL from the search
state before then, which would drop the parameter. `tools/dump-dom.js` already reads `currentSrc`, so
production photos flow into a `.fig` export unchanged.

Rebuilding the pack (raw dump stays outside the repo, only the converted pack is committed):

```
python3 tools/scrape-prod-assets.py --out /tmp/litro-raw
python3 tools/build-prod-assets.py  --raw /tmp/litro-raw
```

`SLOTMAP` in `build-prod-assets.py` is a by-eye classification of each gallery (index → slot). Re-scraping
can reshuffle those indexes, so re-check the contact sheets before trusting it after a fresh pull.

## Searching the whole coast by default

The search starts on **all resorts at once** rather than making you pick one first, and "Tot litoralul"
is the first row in the destination picker (it drops out once you start typing a resort name). With
charter inventory the offer is the product, so the fastest useful screen is the whole coast ranked,
not an empty state waiting for a resort. An empty `dest` means all resorts throughout the engines.

The listing headline no longer repeats the site-wide review score next to the place name — it carries
the result count and nothing else.

## The charter set — "Garantat de noi"

LITRO contracts allotments directly. Those hotels are a different product from the rest: the availability
shown is our own stock, confirmation is instant, and our consultants can change the booking without
waiting for the hotel. The prototype makes that set findable and promotable:

- `data-own="1"` on a card marks a charter hotel. The engines inject a navy **„Garantat de noi"** badge
  (EN: "Guaranteed by us") and give the card a navy left accent; clicking the badge opens the explainer.
- Homepage gets a **"Hoteluri garantate de noi"** row, desktop and mobile, in both languages.
- The listing gets a **"Garantat de noi" filter**, and the default "Recomandate de noi" sort puts the
  charter set first.
- The hotel page carries the badge under the title (`data-own="1"` on `<body>`).
- The charter cards get a **navy frame** — a 2px border plus a soft navy halo — and the badge sits in
  the tag row. Tried and rejected on the way there: a pale tint (read as a selected row, not an offer)
  and a full-width navy ribbon across the card head (too loud for a list of six).
- The row's "see all" link opens the listing already filtered: `?f=own` (any filter key works, and it
  clears the page's preset filters first, so the link lands on exactly one intention).

## Signing in

The prototype had no way to sign in, only to join FRIENDS. Now: an account button in the mobile app
bar (with an orange dot for guests, an avatar for members), the desktop header entry rendered as a
real button for guests, and a **"Ai deja cont? Autentifică-te"** band on the homepage that disappears
for members. All three open the same sign-in / create-account sheet, which explains what an account
buys — bookings and vouchers in one place, paying the balance online, 2% FRIENDS credits — and
flipping it to signed-in updates the prototype panel too. Fields are mock placeholders; nothing is sent.

## The gallery opens as a mosaic, not as a slideshow

Clicking any hotel photo — the hero, a thumbnail, the "see all N photos" button — opens **step 1: a mosaic
of every picture**, with category chips (rooms / pools / beach / spa / the property / from guests) carrying
counts, and tiles in mixed sizes. Clicking one tile goes to **step 2: the big image with a horizontal
thumbnail strip below it**, arrow-key navigation, a counter and a "‹ All photos" control back to the mosaic.

The big photo in the page header also carries **the same arrows as a listing card**, with a counter,
so the property's own photos can be leafed through in place without opening anything; guest photos
stay behind the gallery. Clicking the photo itself still opens the mosaic.

A side rail stays visible through both steps: the review score, two guest quotes, the price and a
"See the rooms" CTA. A gallery that only shows pictures parks the visitor; this one keeps the reason to
book in the same view.

**On mobile the second step keeps the mosaic instead of a thumbnail strip.** A horizontal strip under
the photo wastes the whole lower half of a phone screen, so the chosen picture sits *above* the same
mosaic — the selected tile is ringed in orange, tapping another swaps the photo, and the header's back
arrow drops the big photo and returns to plain browsing (it only closes the gallery from there).
Tapping the photo, or the **Mărește / Zoom** button on it, opens it **full-screen with real zoom**:
pinch, double-tap to toggle 100 % ↔ 250 %, ± buttons up to 400 %, drag to pan, and panning is clamped so
the picture can never be dragged off screen.

## Photos and clips from guests, and a way to add them

The property's own photos are the marketing version of a hotel. Guest photos are the ones it cannot
retouch, so they get a named block **under the guest reviews** — the reviews are what a visitor came to
that section for, and the guest pictures plus the invitation to add your own read as the continuation of
them rather than as an interruption:

- a strip of portrait tiles with each uploader's name, video tiles with a duration badge, and a "+42" tile;
- review cards that carry their own photos and clips, with a **verified-stay** line;
- everything opens the same gallery, filtered on *From guests*;
- **"Add photos or clips"** — a drop zone, a file list you can prune, an optional caption, and an
  **unticked consent that gates the send button** (same rule as checkout: a pre-ticked box is not consent);
- **"Write a review"** — a score out of 10, what you liked, what could be better, and files attached
  inline so nothing typed is lost;
- both promise moderation within 24 hours, and the first published set earns **+20 FRIENDS credits** —
  the loyalty scheme that already exists is what makes uploading worth a guest's time.

Uploads are mockups: nothing is sent, and the guest photos reuse the placeholder pool at different crops.

## Documents carry their state

On the confirmation screen every document says whether it exists yet: a **green circle with a tick** for
what is ready now (voucher, traveller contract, terms), a **gray circle with an hourglass** on a dashed row
for what is issued later (deposit invoice, final invoice, room assignment), with the action reading
*Download* or *Coming soon / At check-in*, plus a legend under the grid. After paying, the open question is
what you already have and what you are still waiting for — one uniform document icon answered neither.

## Anti-dead-end behaviour on the listing

With charter inventory a search can honestly return two hotels, so the widgets that prevent a dead end
are driven by the visible result count rather than being always-on decoration:

| Results | What the page does |
|---|---|
| 6 or more | Rescue widgets stay out of the way; "load more" is shown |
| 5 or fewer | Flexible-date strip, a "look at other options" line and the nearby-resorts band appear; "load more" and the pager disappear; the headline switches to the real count |
| 2 or fewer | The call-centre band moves directly under the last result, turns orange and names the number left |
| 0 | Empty state: clear the filters, or hand the search to a consultant |

## A page of results is really a page of results

The pager says "Afișăm **1–30** din **1 236** cazări", so the list has to actually hold 30 cards —
otherwise the very first screen contradicts itself. Only a handful of cards are written by hand in
each `listing*.html` / `home-b|d.html`; `fillListingPage()` in `proto.js` (and its twin in
`proto-m.js`) clones them up to `PAGE_SIZE` before anything else in `initListing()` runs, so every
new card gets the same photo gallery, filters and room expander as the hand-written ones.

Clones vary what belongs to a property — name, resort, distance to the beach, stars, score, review
count, price per night, photo, room type, guest quote — and **inherit everything else from the card
they were cloned from**, so the chips never drift from the data attributes behind them (board,
confirmation type, own inventory). The names are real properties from litoralulromanesc.ro, Mamaia
first so the list stays believable when someone searches there, then along the coast, which is what
the default "Tot litoralul" search means. In production-photo mode each of them pulls its own
photos, so a full page also shows how much the real photo base varies from property to property.

The demo inventory switch still caps what is visible (Many → the full page, Some → 4, Few → 2,
Zero → the empty state), and a filter that is on by default — `listing.html` and `home-b.html` ship
with **Piscină** applied — legitimately shows fewer than 30.

**How long a page should be is itself a question**, so it is a switch: the panel row *Results per
page* (10 / 20 / 30, `?per=`) moves the list and the pager together. Thirty cards is a long scroll
before anyone reaches the pager; ten brings pagination into the first screen and puts more weight on
sorting. The DOM always holds the full thirty — `PAGE_SIZE` only decides how many of them are shown,
so switching is instant and nothing has to be re-rendered.

## Pagination, not infinite scroll

Results are paginated at **30 per page** on both desktop and mobile. "Show more results" was replaced
by a pager plus a range line — *Afișăm 1–30 din 81 cazări* — because a load-more button hides both how
much is left and where you are, and infinite scroll additionally buries the footer and makes a result
impossible to return to. The pager hides itself below 31 results, so a filtered set of three does not
get decoration it does not need.

## The two panel sheets — changelog and use cases

At the foot of the demo panel are two things that are *content*, not switches: they explain the
prototype rather than change it, so they are collapsed by default and fetched only when opened.

**Jurnal de modificări** is generated from Git by `tools/build-changelog.js`: date, subject, the
screens the commit touched (as links) and the commit SHA linking to GitHub. It exists because a
stakeholder comparing today's screen against yesterday's screenshot needs to know which one they
are holding. Note the ordering constraint — *a file cannot contain the SHA of the commit that
writes it*, so the changelog is generated **after** the content commit and committed on top. The
refresh workflow does that automatically; by hand it is two commits.

**Situații de utilizare** is generated from the hand-written `usecases.json`, which is the real
deliverable here. It documents what each demo state *means* as a product situation — guest vs
member, full inventory vs zero, each card density — and declares ten scenarios that pin a complete
state, each with a deep link that opens it. Two validation rules keep it honest and
`tools/build-usecases.js` fails the build on either: **every axis and every option carries a `doc`**,
and **every option appears in at least one declared use case**. Twelve axes and twenty-nine options
are covered today. The matrix is deliberately declared rather than exhaustive — twelve axes make
thousands of combinations and almost none is a real situation.

Both sheets need `fetch`, which a browser refuses to do for a sibling file over `file://`. From a
local copy they say so; run `node tools/serve.js` or use the published URL.

## Stakeholder comments

An optional workshop layer: an allowlisted Google-signed-in reviewer drops a **pin on the element
being discussed**, writes a thread, replies, and resolves it — live for everyone in the room. A
comment anchors to the **view**, not just the element: page, viewport, language and the demo state
it was written in, so a thread opened on "member + zero inventory" reopens in that state. If the
element moves, the layer falls back to the visible text; if that fails too, the thread goes to the
detached tray rather than being silently lost.

**The layer is installed but dormant.** It stays a quiet no-op until `comments.config.json` exists
beside the screens, which needs a Firebase project this repository cannot create. To turn it on:

1. Create the Firebase project, enable **Authentication → Google**, deploy `comments.rules` to
   Firestore, and add the published Pages domain to the Google provider's **authorized domains**.
   Skipping that last step looks exactly like an OAuth popup that closes for no reason.
2. Copy `comments.config.example.json` to `comments.config.json` and fill in `prototypeId`, the
   Firebase **web** config and `allowedEmailDomains`. The web config is public by design — the
   Firestore rules and the allowlist are what protect the threads. The file takes only the fields in
   `comments.config.schema.json`: never a service account, a private key or any JavaScript.
3. Set `stateKeys` to the axes that should form an anchor. Keep that list stable: changing its shape
   orphans existing threads.

Then the workshop loop is `node tools/comments.js dump` → make the agreed change → write
`comments/replies.json` → `node tools/comments.js apply comments/replies.json --round <N> --commit <SHA>`.

> **Before inviting reviewers, tell them the threads — with their names and email addresses — are
> stored by the configured third-party service (Firebase/Google Cloud).** Dumps carry that same
> personal data: `comments/` is gitignored and must stay that way. A comment dump is also *not* a
> review — it feeds a workshop round, not `/impl-guide`. `/ux-review`, `/conversion-review` and
> `/legal-review` remain the routes that turn this prototype into findings.

## Rebuilding the generated artifacts

```bash
node tools/refresh.js            # changelog → use cases → hub previews → litro-final.fig
node tools/refresh.js --fast     # skip everything that needs a browser
node tools/refresh.js --only fig # just the Figma export
```

The screens themselves still need no build step — this only regenerates derived artifacts. The
`.fig` comes from `prototype.json`, so adding a state to the export is a line of JSON, not an edited
script. Two things that will waste an afternoon if forgotten:

- **The data chunk must be zstd.** With deflate, Figma accepts the file and then hangs forever at
  "0 of 1 files" with no error. The schema chunk stays deflate-raw, copied byte-for-byte from the
  donor at `tools/.schema/canvas.fig` — a 28 KB schema fragment, header plus chunk 0 and no design
  data, which is why it can be committed when a source `.fig` export cannot.
- **Frames are dumped with `?nopanel=1`.** Any new `position:fixed` element must be added to the
  export-mode CSS, or it is captured at the bottom edge of the capture window and lands in the
  middle of the exported frame.

`.github/workflows/prototype-refresh.yml` runs the same thing in CI after a screen commit and pushes
the regenerated artifacts back. Its three loop guards — `paths-ignore`, the `[skip ci]` marker on the
bot commit, and `concurrency` — must stay together; removing any one makes the workflow retrigger on
its own commit. It installs from `tools/package-lock.json`, which is why the root `.gitignore`
entries for `package.json` are anchored with a leading slash.

## Design decisions that are business rules, not taste

These came out of walking the live site and must not be "cleaned up" by a designer later:

- **Prices are not all-in.** `taxa de stațiune` (1% of the tariff ex-VAT) is paid at reception → every price
  block carries a separate "De plătit la hotel" line.
- **Confirmation is per rate.** Part of the allotment is request-based, so rates carry either
  "Confirmare instantă" or "Confirmare în max. 2 ore". Never promise instant confirmation globally.
- **Consent is unticked** and the CTA is gated until it is ticked; marketing consent is a separate,
  optional tick. Pre-ticked consent is invalid under GDPR.
- **Legal identity is mandatory** on every screen: S.C. Creative Eye S.R.L., Licența de Turism nr. 536,
  ANPC and Ministry of Tourism contacts.
- **Property rules come from data**, including negative states (this hotel does *not* accept pets).
- **Counts and facets come from production**, not from the mock (Mamaia = 81 units, not 319).

## Source files

The two source Figma exports (`Redesign sandbox.fig` ≈ 123 MB, `🟠 LITRO Master Pages.fig` ≈ 190 MB) live in
the parent folder and are **not** committed — GitHub caps files at 100 MB without Git LFS, and both files
exist in Figma anyway. If you want them versioned here, install `git-lfs` and track `*.fig`.
