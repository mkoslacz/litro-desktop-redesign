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
| `litro-mobile-web.fig` | Native Figma file with all ten mobile screens as editable 430px frames (RO row + EN row) |
| `specs.html` | Measurement spec for developers (component by component, all values in px) |
| `audit.html` | Production gap audit — live funnel vs these screens + call-centre strategy |
| `preview-*.png` | Full-page renders of each screen |
| `litro-desktop-redesign.fig` | Native Figma file with all five screens as editable frames |
| `assets/` | Photos used in the mockups (placeholders taken from the Szallas sandbox) |
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
  hotel gallery is swipeable; the booking bar slides up from the bottom after the first room is added;
  checkout keeps a fixed bar with the amount due today.
- The page column is capped at 430px and centred above 460px viewport width, so the screens can be
  reviewed in a desktop browser without a device.

### The floating "Prototype · settings" panel

Demo switches never belong in the product UI, so they live in one floating panel — bottom right on
mobile, bottom left on desktop:

| Row | What it does |
|---|---|
| Language | RO ↔ EN, carrying destination and dates in the URL |
| View | Desktop ↔ Mobile — the only way to reach the phone screens from a full-size browser window, and back |
| Account | Guest ↔ Member (hides the "sign in for FRIENDS" bands) |
| Card view *(listing)* | A detailed · B compact with the date/board/room icon row · C horizontal summary |
| Demo inventory *(listing)* | Many / Some / Few results — drives the count, the empty state and the flexible-date banner |

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
