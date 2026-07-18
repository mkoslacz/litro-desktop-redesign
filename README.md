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
| `litro.css` | The design system: colour/radius/shadow/type tokens + every component |
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
