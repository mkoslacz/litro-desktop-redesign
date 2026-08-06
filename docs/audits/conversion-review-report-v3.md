# Conversion Review — v3

> **What this report is.** The audited artifact is a **clickable design prototype**, not a running
> shop. The question a prototype review answers is: *of the decisions this design has already made,
> which ones will cost money once they are built — and which correct ones would a later cleanup
> destroy?* This run additionally carries a **scope brief from the owner**: evaluate the options
> exposed in the prototype's floating demo panel ("Prototip · setări"), each of which is a design
> decision the prototype deliberately externalizes as a switch. That evaluation is in
> *Demo-panel option evaluation* and its verdicts feed the findings and handoff gaps rather than
> replacing them.
>
> Mockup scaffolding — seeded data, static form fields, absent analytics, no backend, no payment
> integration — is out of scope as a finding and collected under *Handoff gaps*.

## Audit metadata
- **Date:** 2026-07-30 20:45:02
- **Environment audited:** local static prototype — `http://localhost:8080` (`node tools/serve.js`)
- **Artifact maturity:** **PROTOTYPE** — same six-of-six negative signals as v2 (no order
  persistence, no payment, zero tracking call sites, seeded inventory, README self-describes as a
  redesign prototype, static host).
- **Implementation repo:** `desktop-redesign` — branch `main`, commit `c85e402` ("Make the page
  length a switch: 10 / 20 / 30 results") **plus an uncommitted working-tree diff** (the round-16
  fixes: bfcache `pageshow` cleanup in both engines; `.hcard`/`.heart`/`.resort-index` wiring moved
  into `initGeneric`). The audit ran against the working tree; the canonical snapshot covers it.
- **Reviewer:** Claude (conversion-review skill)
- **Toolkit version:** 1.30.0
- **Evidence mode:** **HEURISTIC** — by construction: no traffic, no analytics, no orders. No reach
  figure is measured and none is guessed; ordering uses funnel position.
- **Out of scope by artifact maturity:** seeded prices and inventory counts, placeholder facet
  counts, static `.inp` form fields, the single-hotel detail template (clone cards all open Complex
  Mediteranean's page), hardcoded demo identity, absent analytics/backend/payment/email.
- **Data window & sources:** none.
- **Ordering basis:** **funnel position** (entry → discovery → evaluation → decision → checkout →
  payment → post-purchase), high-value-shape exception applied and stated per row.
- **Denominator:** not applicable — no sessions exist.
- **Target surface:** both — desktop 1440×900 and mobile web (390-430px column), each finding names
  the surface it was confirmed on.
- **Derived KPI tree (unchanged from v2, P0 confirmed by the owner 2026-07-29):**
  **P0 = a paid booking completed online** (30% advance or full) on own charter inventory. The call
  centre is **not** a P0 path; every hand-off to `0241 999` scores as a leak unless no online path
  could exist. **Micro-conversions:** search performed → results seen → hotel opened → rate selected
  → checkout started → payment attempted → confirmation. **P1 (inferred order, unconfirmed):**
  call-centre contacts per 100 bookings → share paid in full up front → cancellation rate → AOV →
  FRIENDS enrolment → marketing consents.
- **KPI tree confirmed by the user:** P0 yes (carried from v2). P1 ordering no — inference.
- **Markets walked:** RO (primary) + EN twins. **Devices:** desktop 1440×900; mobile via the m-*
  pages' capped column (DOM-level checks).
- **Auth / consent states walked:** guest (default) + the panel's member state on home-c. No consent
  layer exists in the prototype.
- **Payment step coverage:** not exercised — no payment integration exists.
- **Source access:** full repo. All code anchors are first-party.
- **Review scope:** **C/D flow, desktop + mobile, RO + EN — same as v2 — plus the owner's scope
  brief: evaluate every demo-panel option.** Variants A and B remain excluded (their pages carry
  their own preset-filter state and were not walked). Cluster A not run as findings (PROTOTYPE
  rule); reach falls to funnel position.
- **Session split:** single session.
- **Side effects created:** none — localStorage only, cleared at start.
- **Analytics pollution:** none possible. **Bot-protection events:** none.
- **Walkthroughs completed:** 5 (RO family default path end-to-end · RO couple/1-room path · EN
  path to checkout · home-d + full option sweep · mobile spot-set) · **complete price paths:** 3
- **Evidence-reliability note:** the in-app browser pane was hidden for the whole run
  (`visibilityState: hidden`), so `requestAnimationFrame` never fired and scrolled-state screenshots
  render blank. Scroll-dependent states (sticky bars, sticky filter column) were therefore settled
  by invoking the prototype's own `stickySync()` synchronously through the panel's switch handlers,
  plus code reading; all other evidence is DOM/geometry reads, which run without paints. No finding
  rests on a screenshot.
- **NOT CHECKED (blind spots):** variants A and B and their preset-filter behaviour ·
  `listing-b`/`listing` templates · the two-step gallery, UGC upload and review modals (unchanged
  since their round) · promo-code and voucher-split interaction beyond markup presence · bfcache
  behaviour live (requires cacheable headers; the round-16 `pageshow` fix is code-verified only) ·
  mobile sticky `.mini` compression states · everything behind a payment control · performance,
  caching, revalidation, time zones · review authenticity (no backend).

## Source boundary
- **Planning authority:** **sourceable**, pending the detached ingress receipt. The prototype repo
  is the implementation repo; every finding carries a first-party anchor.
- **Implementation source:** `litro-desktop-redesign` / component `prototype`, canonical snapshot
  `sha256:130bbeb67c06f31bcfef583d46b7c75889c747f1b7aa8729fb054907290e3090`, captured before the
  audit from the dirty working tree at `c85e402`, `docs/audits` and `node_modules` excluded,
  verified `complete`.
- **External build/release identity:** not applicable — no release exists.
- **Planned graph IDs:** review run `run-conversion-review-v3-20260730-204502` · artifact
  `artifact-conversion-review-report-v3` · expected graph heads
  `evt_098102bf3c67b1f148be6318` (the v2 ingress event — the graph's single head). The code moved
  outside the pipeline since that head's ref set; the ingress carries the new frontier itself.
  `CONV-nn` is a producer key, never a case ID.
- **Detached receipt:** generated after the report bytes are final, stored outside the report body.
- **State boundary:** code `observed at snapshot 130bbeb6` · evidence `observed + source-verified` ·
  integration `not evidenced` · deployment `not evidenced` · live/release `not evidenced`.
  (GH Pages carries commit `c85e402` per the repo's own README badge habits, but no deployment
  evidence was collected in this run — the round-16 diff is local-only either way.)

## Change dashboard

| Metric | v2 | v3 | Delta | Trend |
|---|---|---|---|---|
| Critical / Medium / Low | 0 / 5 / 4 | 0 / 7 / 4 | +2 medium | ↑ |
| Blockers | 0 | 0 | 0 | → |
| Rows with a measured mechanism | 0 | 0 | 0 | → |
| Evidence mode | HEURISTIC | HEURISTIC | — | — |
| Artifact mode | PROTOTYPE | PROTOTYPE | — | — |

Both new mediums are **v2 misses on unchanged code**, not regressions — see *Audit accuracy*. The
scope is otherwise comparable (same flow, same surfaces), so unlike v1→v2 these counts are honestly
comparable, and the story they tell is: nothing closed, two truth defects surfaced.

### Status flow

| Status | Count | Findings |
|---|---|---|
| observed — persists | 8 | CONV-01, CONV-02, CONV-07, CONV-10 (home-d px-identical; home-c +20px), CONV-13, CONV-14, CONV-15, CONV-16 (one painter call site more than v2's census: `proto.js:1259`) |
| observed — improved in part | 1 | CONV-12 — the flexible-date strip does render at zero (v2 implied it did not; see *Audit accuracy*); the empty-state box itself is still phone-only, and a new aggravator was found (CONV-17 poisons its branch selection) |
| not_observed_at_ref | 0 | — |
| regression | 0 | — |
| unresolved / deprioritized | 0 | — |
| new — unchanged code (v2 miss) | 2 | CONV-17, CONV-18 (both present verbatim at `889ccac`) |

Every row is observational; nothing here closes a case. Only a valid `/impl-verify` flow can set
`verified_resolved`.

**The ledger of what shipped between `889ccac` and this tree** (rounds 13-16): the demo-panel rail
rebuild, the production-photos mode, hero-photo arrows, `fillListingPage` on both engines (the pager
now tells the truth — 30 real cards), the results-per-page switch, a real fix (struck-through
"0 Lei" on zero-discount cards), the bfcache spinner fix (a genuine funnel defect: back-navigation
restored an infinite-loading veil — fixed in the uncommitted diff), `.hcard`/`.heart`/resort-index
wiring into `initGeneric` (closes HAND-07), the sticky-filters option, the m-hotel session-state
inversion fix, and the sticky stay-bar. Substantial, real work — **and zero of the nine open cases
was touched, for the second consecutive delta.** Four of those cases are one-day, S-effort string
and binding fixes that have now outlived three reports.

### Audit accuracy — where v2 was wrong

1. **CONV-17 and CONV-18 are v2 misses, not new code.** The six pre-checked filter rows are in
   `listing-c.html` at `889ccac` and the global instant-confirmation claim is in `home-d.html` at
   `889ccac`. v2 walked both templates and read neither. Recorded against this audit line's own
   accuracy, not as product regressions.
2. **v2 overstated the zero-state's page-level poverty.** v2's CONV-12 detail ("renders no button at
   all — the only interactive element is the phone number") is accurate for the empty-state box, but
   the flexible-date strip — with per-cell result counts and wired date-switch clicks — was already
   rendered directly below it at `889ccac` (`fstrip.style.display = thin ? '' : 'none'`, and zero is
   thin). v2's proposed smallest slice was therefore already true at page level. The residual defect
   is real and stated in the updated CONV-12.
3. **Effort grades:** no v2 finding re-graded by more than one step.

## Product classification & area verdicts
- **Class:** travel marketplace on own charter inventory (agency as organiser)

| Area | Verdict | Note |
|---|---|---|
| 1–5. Measurement & activation | N/A | PROTOTYPE rule — one paragraph, HAND-02 |
| 6. Entry intent & continuity | needs improvement | CONV-10, CONV-18 |
| 7. Search, filters, relevance | problem | CONV-01, CONV-17 |
| 8. Dead ends & recovery | needs improvement | CONV-12 (improved in part) |
| 9. Speed & stability | N/A | no backend; zero console errors across the whole run |
| 10. Viewport economics | needs improvement | CONV-10, CONV-14; listing-c fold itself is healthy (first card y=242, 3 cards visible) |
| 11. Detail page as decision support | needs improvement | CONV-01, CONV-14 |
| 12. Offer integrity | problem | CONV-13, CONV-01, CONV-18 |
| 13. Terms as decision inputs | problem | CONV-07, CONV-02 |
| 14. Social proof authenticity | N/A | seeded review data |
| 15. Claims, defaults, dark patterns | problem | CONV-07, CONV-17, CONV-18 |
| 16. Total price transparency | OK | amount stable on all 3 paths — protect |
| 17. Forward momentum & defaults | needs improvement | CONV-07, CONV-17 |
| 18. Checkout structure & state | needs improvement | CONV-13; form unbuilt (HAND-01) |
| 19. Form friction & guest checkout | N/A | no form exists — HAND-01 |
| 20. Commit-step copy integrity | needs improvement | CONV-16, CONV-02 |
| 21. Payment methods & authorization | needs improvement | CONV-15; rest not exercised |
| 22. Promo & reference-price integrity | N/A as finding | HAND-03; promo/gift field present at `checkout.html:187` |
| 23. Purchase-path accessibility | N/A | no real inputs — HAND-01 |
| 24. Add-ons & upsell | OK | no pre-ticked paid extras — protect |
| 25. Abandonment recovery & lead capture | N/A | no backend/email |
| 26. Post-purchase & repeat | needs improvement | HAND-06 (now also on checkout's voucher assist) |
| 27. Post-conversion lifecycle | needs improvement | CONV-02 balance deadline |
| 28. Marketplace supply | needs improvement | CONV-15, CONV-18 |

## Measurement readiness

PROTOTYPE rule — one paragraph, filed as **HAND-02, still open**: the designed flow needs
`search_performed` (destination, dates, party shape, rooms), `results_seen` (count + which empty
branch), `hotel_opened`, `rate_selected` (rate id, refundable y/n, **online vs request-only**),
`checkout_started`, `payment_attempted`, `booking_confirmed` (advance vs full), each carrying
**`variant` (C/D)**. New this round: the demo panel's switches are exactly the dimensions the first
post-launch experiments will randomize — **card density (A/B/C), page size (10/20/30), pinned-card
mode, sticky on/off** — so the event contract should reserve those variant dimensions now. Without
`online vs request-only` the corrected KPI tree is unmeasurable; without `variant` the C-vs-D
question stays unfalsifiable.

## Funnel snapshot

Shape only — no volumes exist.

| Step | Route / surface | Main leak found |
|---|---|---|
| Entry | `home-c`, `home-d`, `m-home` | 1 877px of unpriced sections before the first price (C) / one card visible (D) — CONV-10; global instant-confirmation claim (D) — CONV-18 |
| Discovery | `listing-c`, `m-listing` | party neither priced nor named — CONV-01; five decorative "applied" filter chips — CONV-17; dead end leads with the phone — CONV-12 |
| Evaluation | `hotel`, `m-hotel` | unbound free-cancellation/pay-nothing promise — CONV-07; frozen deadlines — CONV-02 |
| Decision | rate table | 2 of 7 rows, both premium, have no online path — CONV-15 |
| Checkout | `checkout`, `m-checkout` | "2 ×" invoiced at one room's price — CONV-13; RO strings on EN — CONV-16 |
| Payment | — | not exercised, no integration |
| Post-purchase | `thankyou`, `m-thankyou` | two advances (1 793 vs 1 214) and two balances (4 182 vs 2 832) on one page — HAND-06 |

## Executive summary

The owner asked this run to judge the demo panel's options, and the panel comes out well: of the
twelve switches, four are review instruments that work as designed (language, view, photos,
demo inventory), and of the eight that encode real design decisions, six have defensible defaults
that this report recommends shipping as-is — sticky search on, sticky filter column on, pinned
campaign card in-line (its banner mode costs 287px of first-viewport at entry), room-type expander
on, the hotel page's visitor-session rule, and guest/member states. The two genuinely open option
questions are card density (B shows every decision driver A shows at −55px per card; C is the most
compact but deletes the room-type line and the rooms-carousel entry — the C listing's own thesis)
and page length (no pre-launch evidence can settle 10 vs 30; the switch itself is the right
instrument, wired into the event contract).

The artifact's real problem is unchanged from v2, and it is now three reports old: the four
S-effort truth defects — a cancellation/pay-nothing promise rendered over a non-refundable rate
(CONV-07), frozen deadline literals that are wrong for every real stay and now disagree between
surfaces (CONV-02), a checkout that invoices two rooms at one room's price (CONV-13), and an EN
checkout that states the balance obligation in Romanian (CONV-16) — were not touched while roughly
four thousand more lines shipped around them. This run adds two more defects of the same family,
both already present at v2 and both missed then: the C listing opens with five pre-checked filter
chips that filter nothing and that poison the dead-end diagnosis (CONV-17), and the D homepage
headline promises instant confirmation for all 1 236 offers while the same design's rate table
holds request-only rows (CONV-18). The sequencing recommendation is one sentence: ship the
truth-defect batch before any new surface, because every surface added since v1 has duplicated the
defects it inherited.

## What this design gets right

Deliberate, non-obvious, easy to destroy. Every line repeats verbatim in *Funnel invariants*.

- **The amount is stable from result tile to payment.** Re-verified on 3 complete paths this run
  (5 975 / 7 150 / 8 085 Lei end-to-end, discounts arithmetically exact).
- **`Taxa de stațiune` stays outside the headline price and is named payable at the hotel** —
  "≈ 50 Lei · se achită la recepție" at checkout, every surface.
- **No paid extra is pre-ticked; purchase consent is separate from marketing, unticked, and the CTA
  is genuinely gated** (`btn-disabled` until ticked — re-verified desktop and mobile).
- **No overlay fires on a checkout route.**
- **The stay bar edits dates and guests in place on the hotel page** and now stays sticky through
  the rooms section.
- **Request-only rows are visually separated** ("Indisponibil online") rather than hidden — CONV-15
  wants the business model changed, not the honesty removed.
- **The advance is editable within stated bounds; confirmation documents carry real ready/pending
  states.**
- **The hotel page's session rule:** a visitor from our own listing gets no redundant search surface;
  a cold visitor gets the search card and the docked search bar. Correct in both states, desktop and
  mobile, and easy to flatten in implementation.
- **The docked sticky search bar is the header compressed, not a second navigation** — same
  popovers, same submit handler, phone + account + menu carried along (round 12b's decision). It
  never appears in export mode.
- **The anti-dead-end ladder is result-count-driven** — flexible-date strip with per-cell counts,
  nearby-resorts band, call-centre escalation only at ≤2, pager auto-hides — instead of always-on
  decoration. The last rung is where CONV-12 lives, but the ladder itself is right.
- **The pager tells the truth** — "Afișăm 1–30 din 1 236" sits over 30 real cards (round 15). This
  was shipped between v2 and v3 and should not regress.
- **Every demo-panel state is URL-addressable** (`?density= ?per= ?stf= ?sthome/stlist/sthotel=
  ?pin= ?session= ?auth= ?assets= ?inv=`) — any variant can be linked, screenshotted and later
  A/B-referenced without clicks. This is the workshop capability the whole option evaluation stood
  on; keep it through implementation as the experiment-flag surface.

## Demo-panel option evaluation — the scope brief

Twelve rows in the panel (desktop; mobile carries nine — no filter-column or pinned-card row, and
`Session` appears only on hotel pages). Four are **instruments** for reviewing the design; eight are
**externalized design decisions**. Verdicts below; a verdict is only a finding where a CONV/HAND id
is cited.

| # | Panel row | Kind | States (default first) | Verdict for launch | Anchor |
|---|---|---|---|---|---|
| 1 | Limbă | instrument | RO / EN | Both ship; EN is gated on CONV-16 — today the EN checkout states the balance obligation in Romanian | CONV-16 |
| 2 | Vedere | instrument | Desktop / Mobil | Navigation between surfaces; parity held on everything walked | — |
| 3 | Fotografii | instrument | Prototip / Producție | Works as designed: 34/35 images swap via `srcset`, the pinned creative is correctly exempt, revert is clean. Run the C flow in Producție mode as a design-team gate before handoff — the layout must be accepted on the real photo base, not the stock one | — |
| 4 | Cont | state | Musafir / Membru | Both states correct; the guest-only account band costs 118px of fold on home-c (first price 2 472 → 2 354 as member) — its *placement*, not the toggle, is CONV-10's ballast | CONV-10 |
| 5 | Sesiune *(hotel)* | decision | De pe site / Vizitator nou | **Protect as-is.** Site → no search surface at all; new → search card + docked bar on scroll. Verified on desktop and mobile (round 12c fix live). This is the kind of deliberate rule an implementing team flattens by accident | invariant |
| 6 | Tipuri de cameră *(listing)* | decision | Da / Nu | **Da** for the C flow — the rooms expander is variant C's differentiator; Nu reduces C to B | — |
| 7 | Densitate celule *(listing)* | decision | A / B / C | **The one option worth a real decision meeting.** Measured: A 278px/card, B 223px, C 188px (≈2.4 / 3.0 / 3.5 cards per 900px viewport). B renders every decision driver A renders — price, struck price, rating+count, beach distance, room type, board, confirmation chip, photo arrows — at −20% height. C drops the room-type line and the rooms-carousel entry, i.e. the C variant's own thesis and the family shape's key information. Recommendation: **default B**, keep A as the comparison arm in the first live experiment, do not ship C for the C flow unless the room line moves into its icon row. Pre-launch this is judgement; the event contract (HAND-02) must carry the density dimension so the first live round settles it | HAND-02, HAND-08 |
| 8 | Rezultate pe pagină *(listing)* | decision | 30 / 20 / 10 | All three work (pager 42/62/124 pages; DOM always holds 30, switch instant). Fold identical — the difference is pager distance (~8.6k px at 30 vs ~2.9k at 10) and how much weight the default sort carries. No pre-launch evidence can rank them: keep **30** for a browse-heavy charter catalogue, reserve the `page_size` dimension in the event contract, and let scroll-depth + pager-usage data decide | HAND-02, HAND-08 |
| 9 | Coloana de filtre *(listing)* | decision | Lipită / Curge | **Lipită.** Verified: `position:sticky; top:74px` under the docked bar (the `:has(.ssearch.on)` offset coupling works), own internal scroll (max-height 814px), correctly exempt in export mode. On an 8 600px list, refine controls that stay reachable are worth the 0px they cost — the column occupies its own grid track. Curge has no advantage beyond print-likeness | invariant |
| 10 | Inventar demo *(listing)* | instrument | Mult / Mediu / Puțin / Zero | The instrument is exactly right — it drives the real anti-dead-end ladder, which behaved as documented at 4, 2 and 0 results. What it *revealed* is the finding: at Zero the box's only action is the phone (CONV-12), and the branch diagnosis reads decorative checkboxes (CONV-17) | CONV-12, CONV-17 |
| 11 | Bară de căutare lipită | decision | Home Da / Listing Da / Hotel Da | **Da / Da / Da(new-visitor-only)** — the current defaults. The docked bar is the compressed header (verdict above), h=62px — a recurring viewport tax paid for one-tap re-search on a date-driven product; on hotel it already respects the session rule (never shown to visitors from our own listing). Keep the three switches independent through implementation — they are separate experiment flags, not one | invariant, HAND-08 |
| 12 | Card fixat *(carousels)* | decision | Linie / Banner / Nu | **Linie.** Measured on home-c: inline costs 0px of fold (creative takes carousel slot 1, tiles 378→348px, ~3 still visible); Banner pushes the search hero's end from y=595 to y=882 and the first price from 2 472 to 2 759 (+287px) — at 1440×900 the hero's bottom edge sits at the viewport's edge. Banner is a tent-pole-week mode, usable only if something above the fold gives way; Nu wastes a production campaign asset that costs nothing in-line | HAND-08 |

**The panel itself is a deliverable.** Its current defaults are the de-facto shipped design; nobody
has recorded that they are chosen rather than accidental. That decision memo is **HAND-08**.

## Legal side-notes — non-blocking, for `/legal-review`

Nothing here is work, none of it is ranked, and this report takes no position on any of it.

| Behaviour | Where | Also reported as | Likely direction if remedied |
|---|---|---|---|
| "Free cancellation" and "you pay nothing now" rendered over a rate the same table labels non-refundable, pay-in-advance | `hotel*.html`, `checkout*.html` | CONV-07 | Positive — removes a dispute source |
| A cancellation deadline that has already passed for the stay being sold, printed beside the correct rule | `checkout.html:173` and hotel/thankyou surfaces | CONV-02 | Positive — the correct date gives the customer more flexibility |
| An order summary stating a quantity the total does not cover | `proto.js:2096` | CONV-13 | Neutral to positive |
| A unit sold to a party exceeding its own declared capacity | `m-hotel.html:147` vs the flow | CONV-01 | Neutral — fewer completions for oversized parties is the point |
| "1 236 de oferte · confirmare instantanee" as a blanket claim over a mixed instant/request model | `home-d.html:262`, `home-d-en.html:262` | CONV-18 | Slightly negative for headline optics; the honest per-rate version already exists as chips |
| Filter chips presented as applied that have no effect on results | `listing-c.html:146,195,219-222` | CONV-17 | Positive — removes a false-state surface |
| Struck-through reference price computed from the discount badge (`total / (1 − disc)`), no stored 30-day low | `proto.js:570`, `proto-m.js:214` | side-note only (HAND-03) | Likely negative for discount optics; unavoidable if reference prices stay |
| "expiră în X zile" as literals with no campaign end date | `listing-c.html`, `home-b/d*` markup | side-note only (HAND-04) | Neutral — an honest version exists |
| Default sort "Recomandate de noi" ranks own charter stock first with no ranking-parameters disclosure on the listing | `proto.js:1536-1544`; no disclosure control on `listing-c` | side-note only | Neutral for conversion; disclosure is a transparency obligation question for `/legal-review` |

Nine side-notes against eleven findings — a normal ratio; the first two remain the ones worth
counsel's time before launch.

## Findings

Ordered Tier → Class → funnel position → Effort. Severity is derived (Tier + Class + mechanism
demotion) and deliberately diverges from row order. `/impl-guide` filters on Severity.

| ID | Area | Finding | Tier | Severity | Status | First observed | Step | Reach | Class | Evidence | Effort | Decision | Location |
|----|------|---------|------|----------|--------|----------------|------|-------|-------|----------|--------|----------|----------|
| CONV-01 | 7, 11, 12 | Party shape neither priced nor named: default search (2+2, 2 rooms) is captioned "2 adulți" at a single-room price; declared unit capacity is never compared to the party | P0 | medium | observed — persists | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | discovery | n/a — high-value shape (family / multi-unit) | Friction | [OBSERVED]/[CODE] | M | SHIP | `proto.js:71`, `:563`, `stayTotal :103`; `m-listing` summary vs cards; `m-hotel.html:147` |
| CONV-15 | 21, 28 | The two highest-priced rate rows (2 of 7) cannot be booked online — own charter stock routed to a 10:00–18:00 phone line | P0 | low | observed — persists | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | decision | n/a — high-value shape (top price band) | Friction | [OBSERVED]/[HYPOTHESIS] | L | INVESTIGATE | `hotel.html` `tr.rate-request` ×2; `hotel-en.html`; `m-hotel.html` |
| CONV-18 | 6, 12, 15, 28 | The D homepage headline promises instant confirmation for all "1 236 de oferte" while the same design's rate model holds request-only rows and its own filter row counts only 63 instant properties | P0 | medium | new — unchanged code (v2 miss) | this run — run-conversion-review-v3-20260730-204502 | entry | n/a — funnel position (entry) | Leak | [OBSERVED]/[CODE] | S | SHIP | `home-d.html:262`, `home-d-en.html:262` (softer instance `:254` + home-c hero trust-note) |
| CONV-14 | 10, 11 | "Hoteluri garantate de noi" — the band carrying the strongest asset shows a trust claim in the price slot and no price, while the identical component 500px below is priced | P0 | low | observed — persists | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | entry | n/a — funnel position (entry) | Leak | [OBSERVED]/[HYPOTHESIS] | S | INVESTIGATE | `home-c.html:304-331` `.price-note`; `m-home.html:155-173` |
| CONV-10 | 6, 10 | Neither homepage variant reaches its thesis in the first viewport: home-d shows one offer card (y=663, px-identical across three reports); home-c places ~1 877px of unpriced sections between search and first price (2 472; member state 2 354) | P0 | low | observed — persists (C marginally worse, +20px) | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | entry | n/a — funnel position (entry) | Leak | [OBSERVED]/[HYPOTHESIS] | M | INVESTIGATE | `home-c.html` section order; `home-d.html` `.listing-grid` |
| CONV-17 | 7, 15, 17 | The C listing opens with five pre-checked filter rows rendered as removable "Filtre:" chips that filter nothing — `applyFilters` reads only the six `data-f` facets — while the chip "Direct pe plajă" sits over cards reading "120 m de plajă", and the same decorative `.cb.on` state selects the dead-end diagnosis branch in `showEmptyState` | P0 | medium | new — unchanged code (v2 miss) | this run — run-conversion-review-v3-20260730-204502 | discovery | n/a — funnel position (discovery); fix ordered before CONV-12's remainder (it gates the branch) | Leak | [OBSERVED]/[CODE] | S | SHIP | `listing-c.html:146,195,219-222`; `proto.js` `applyFilters`, `showEmptyState:1456` |
| CONV-12 | 8 | The dead end is caught but still handed to the phone: at zero results the box's only action is `0241 999` (no control), and the richer rescue band with the callback form is hidden exactly at zero (`thin && shown > 0`); the adjacent flexible-date strip does render and is wired — the box just never points at it as a control | P0 | medium | observed — improved in part | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | discovery | n/a — funnel position (discovery) | Leak | [CODE]/[RESEARCH] | S | SHIP | `proto.js:1404-1472` (`showEmptyState`, `syncRescue`) |
| CONV-07 | 13, 15, 17 | "Nu plătești nimic acum · confirmare instantă" and "Anulare gratuită până la 20 mai" render over the rate the same table labels "Nerambursabil · plată în avans" — re-verified to survive explicit selection of that rate | P0 | medium | observed — persists | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | evaluation | n/a — funnel position (evaluation) | Leak | [OBSERVED]/[CODE] | S | SHIP | `hotel.html:137,140`; `hotel-en.html:137`; `m-hotel.html`; `checkout.html:173` |
| CONV-02 | 13, 20, 27 | Every cancellation and balance date is a frozen literal — "20 mai" (hotel, checkout) vs "26 mai" (thankyou, m-checkout consent row) vs balance "22 mai" everywhere — wrong for every stay except the demo one, and different surfaces still show different deadlines for one booking | P0 | medium | observed — persists | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | evaluation | n/a — funnel position (evaluation) | Leak | [OBSERVED]/[CODE] | S | SHIP | `hotel.html:140,268,277,330`; `checkout.html:93,173,196`; `m-checkout.html:135,202`; `proto.js:2082,2278`; `proto-m.js:1901,2046` |
| CONV-13 | 12, 16, 18 | The checkout summary multiplies the room name by the searched room count while the total covers one room — "2 × Cameră dublă vedere mare" at 5 975 Lei, re-observed live; booking bar said "1 camere" one step earlier | P0 | medium | observed — persists | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | checkout | n/a — funnel position (checkout) | Leak | [OBSERVED]/[CODE] | S | SHIP | `proto.js:2096` |
| CONV-16 | 20 | The EN checkout states the product, nights, board and the entire balance obligation in Romanian ("Restul de 5 659 Lei — online până la 22 mai sau la hotel"), and the EN hotel page's price-strip caption is "vezi prețurile ▾"; the mobile engine translates the same strings | P1:full-prepayment share | low | observed — persists (one more call site than v2's census: `proto.js:1259` board line in the rooms carousel) | artifact-conversion-review-report-v2 / run-conversion-review-v2-20260729-205415 | checkout | n/a — funnel position (checkout); EN segment only | Friction | [OBSERVED]/[CODE] | S | SHIP | `proto.js:2082,2094,2097,2278,1259,1806-adjacent` vs `proto-m.js:1901,1916,2046` |

`CONV-nn` is the stable producer key, not a canonical case ID. The detached receipt maps keys to
canonical cases. `First observed` values are read from `project-cases` (`earliest_observation`);
the two new rows carry this run's own identifiers pending ingress.

## Findings detail

Unchanged persisting rows (CONV-01, CONV-07, CONV-02, CONV-13, CONV-14, CONV-15, CONV-10, CONV-16)
keep their v2 detail blocks — repro, mechanism, fix, smallest slice, DoD — verbatim except the
deltas below. New and materially updated rows get full blocks.

### CONV-01 · CONV-07 · CONV-02 · CONV-13 · CONV-16 — deltas only
- **CONV-01:** re-observed on all surfaces; the m-listing contradiction ("4 pers. · 2 camere" in the
  summary directly above "2 adulți" captions) is one screen. Capacity is still prose in `.rmeta`.
  Fix and slices unchanged from v2.
- **CONV-07:** re-verified that the promise survives explicit selection of the contradicting rate —
  the bar is unbound, not a default-state artifact. Fix unchanged: bind to the selected rate's
  policy fields; never default-reflect a cancellation-bearing rate.
- **CONV-02:** census re-taken at the current tree (13 literal sites across 8 files + 4 painter
  sites). New instance class: `m-checkout.html` shows "22 mai" (:135) and "26 mai" (:202) on the
  same screen. Fix unchanged: two derived values, bound everywhere; delete every literal.
- **CONV-13:** re-observed live on path A. `S.rooms=1` paths render "1 ×" correctly — the defect is
  multi-room-specific, exactly the family shape the default search expresses. Ship with CONV-01.
- **CONV-16:** one additional untranslated painter site beyond v2's census (`proto.js:1259`, board
  line inside the listing-c rooms carousel), and the EN booking bar leaks the RO board name
  ("(demipensiune)") because meal names are carried in state as RO strings. Fix unchanged: wrap the
  `proto.js` call sites in `lang()`, copying `proto-m.js`; decide whether room and board names
  become translated fields. **Exchange rate vs P0** (unchanged from v2): a defect with no
  trade-off — the fix costs nothing in completions; its value is the share of EN bookings whose
  balance is collected online rather than by phone, measurable only in LITRO's own order data.
  **Definition of Done must include:** P0 conversion must not fall; no `proto.js` painter writes a
  user-visible string without a language branch, verified on all `-en` pages.

### CONV-17 — Five applied-looking filters that filter nothing, and they choose the dead-end message

- **Repro:** `listing-c.html?dest=&from=2026-06-05&to=2026-06-12&adults=2&kids=2&rooms=2`, desktop
  1440×900, RO, guest, fresh localStorage. The chips row above the results reads
  "Filtre: Hoteluri × · 5 stele × · 4 stele × · 3 stele × · Direct pe plajă ×".
- **Markets / surface confirmed in:** RO (EN twin carries the same markup) · desktop; the mobile
  filter sheet was not exercised for this state.
- **What happens.** Six `.frow` rows ship with `.cb.on` in the markup (`listing-c.html:146` "Doar
  cazări disponibile", `:195` "Direct pe plajă", `:219-222` "Hoteluri · 5/4/3 stele"). None of them
  carries `data-f`, and `applyFilters` (`proto.js`) reads exactly six `data-f` facets — so the five
  non-avail rows render as removable applied-filter chips that have **no effect on the result set**:
  removing "3 stele" changes neither the cards nor the count. All 30 cards stay visible under the
  chips, several reading "120/200/250 m de plajă" under an applied-looking "Direct pe plajă". The
  same `.cb.on` state is read by `showEmptyState` (`proto.js:1456`) to decide **which dead-end
  message renders**: with any of these decorative checks on, a genuine no-availability zero state
  presents as "Niciun rezultat pentru filtrele alese" with a `Șterge filtrele` button that clears
  decoration and changes nothing.
- **Why it costs conversion.** The mismatch is verified in source, not inferred from behaviour: the
  chips claim a filter state the engine does not hold. On the discovery step this misstates what the
  user is looking at (a "filtered" list that is actually everything), invites removal interactions
  that visibly do nothing — the fastest way to teach that the filter UI is decorative — and on the
  dead end it swaps the correct diagnosis (no availability → move the dates) for a wrong one (too
  many filters → clear them), pointing the user's one recovery action at a control that cannot
  recover anything.
- **Fix.** Decide per row: wire it as a real facet (give it `data-f` + card attributes) or remove
  the pre-checked state and the row's chip. `showEmptyState`'s `filtered` test must read only real
  facets. The "(9)/(29)/(45)" counts stay only on rows that actually filter.
- **Smallest shippable slice:** delete the five decorative `on` classes in `listing-c.html` — one
  markup change; the branch test then reads correctly by construction for the shipped rows.
- **Card type:** implement.
- **Definition of Done must include:** P0 conversion must not fall; every rendered filter chip
  corresponds to a facet that changes the visible result set; the dead-end branch test reads only
  facets a user can actually hold.
- **Blocked by:** none — and CONV-12's remaining fix is sequenced **after** this row, because the
  branch selection this row corrupts is the surface CONV-12 redesigns.

### CONV-18 — A blanket instant-confirmation promise over a mixed confirmation model

- **Repro:** `home-d.html` at 1440×900, RO, guest: the listing headline row reads
  "Toate ofertele de pe litoral — **1 236 de oferte · confirmare instantanee**". Twelve lines below
  in the same file, the availability facet admits "Doar cu confirmare instantanee **(63)**".
- **Markets / surface confirmed in:** RO + EN (`home-d-en.html:262` "1,236 offers · instant
  confirmation") · desktop D variant; softer scoped instances on both variants' search heroes
  ("Inventar propriu · confirmare instantanee", `home-d.html:254` and the home-c hero), which are
  arguably true of the charter subset but read as global.
- **What happens.** The claim is a `data-fixed` literal — no painter, no scoping. The same design's
  rate table carries two `tr.rate-request` rows ("Indisponibil online · doar la cerere") and
  per-rate chips "Confirmare instantă" vs "Confirmare în max. 2 ore", and the repo's own README
  states the business rule this violates: *"Confirmation is per rate. Never promise instant
  confirmation globally."*
- **Why it costs conversion.** Verified contradiction within the artifact: the entry step promises
  what the decision step then takes back. The user shaped by the headline meets "doar la cerere" on
  the two most expensive rows — the exact moment CONV-15 documents — and a promise withdrawn at the
  decision point converts into distrust of the *true* instant-confirmation chips next to it, which
  are the product's genuine differentiator.
- **Fix.** Scope the claim to what the model backs: either drop the suffix from the count line
  ("1 236 de oferte"), or make it the honest subset claim the hero already gestures at ("inventar
  propriu cu confirmare instantanee"). The per-rate chips already carry the truthful version.
- **Smallest shippable slice:** the two `res-count` literals (`home-d.html:262`,
  `home-d-en.html:262`).
- **Card type:** implement.
- **Definition of Done must include:** P0 conversion must not fall; no surface promises instant
  confirmation for a set that includes request-only inventory — the claim's scope always matches the
  model's.
- **Blocked by:** none.

### CONV-12 — updated block (improved in part)

- **What changed.** The flexible-date strip **does** render at zero (gate `thin = shown <= 5`
  includes 0) with per-cell counts and wired date-switch clicks, 120px below the box — this was true
  at v2's commit as well; the accuracy note above records it. Two residual defects, both
  code-anchored: **(a)** the empty box's action row is still the phone alone — prose names the strip
  and nearby resorts, the `acts` row renders no control (`proto.js:1465-1469`); **(b)** the richer
  rescue band — the one with the callback-capture form — is display-gated `thin && shown > 0`
  (`proto.js:1424`), so the deadest state gets the poorest surface: at 2 results the user gets a
  callback form, at 0 they get a phone number.
- **Fix (updated).** In the zero box: a real control pointing at the strip (scroll + focus) and one
  at nearby resorts, phone third; unify the zero state with the ≥1 rescue band so the callback form
  does not vanish exactly when it is most needed; and take the branch test off decorative state
  (CONV-17).
- **Smallest shippable slice:** add the two controls to the `acts` row of the zero box — one
  function, no new components.
- **Card type:** implement. **DoD:** every dead-end state offers at least one in-product recovery
  control before a phone number, and the callback form is available at zero, not only near zero.
- **Blocked by:** CONV-17 (branch test).

## Handoff gaps

Not defects — decisions the artifact does not make. `/impl-guide` reads the Findings table only;
pass this section explicitly if these should become cards.

| ID | Gap | Why it will not resolve itself | Who decides | Lead time | Severity | Status vs v2 |
|----|-----|--------------------------------|-------------|-----------|----------|--------------|
| HAND-01 | The checkout has never been designed as a form: 9 pre-filled `.inp` display divs on desktop, zero real `<input>` on either surface, no empty state, no RO address convention, no validation, no autocomplete tokens | Every review so far has judged a picture of success; the implementing team will invent the whole form | design + eng | L | medium | still open |
| HAND-02 | No event contract. Now also needs the panel dimensions: `card_density`, `page_size`, `pinned_mode`, `sticky_*` — plus the two from v2 that carry the KPI tree: `online vs request-only` and `variant` | The redesign's purpose is unmeasurable without the first pair; the option questions this report leaves to data (density, page length) are unanswerable without the second set | design + eng + business | M | medium | still open, scope grew |
| HAND-03 | The reference price still has nowhere to live: `proto.js:570` / `proto-m.js:214` derive the struck price from the badge (`total / (1 − disc)`) | No field exists for a stored 30-day low, so the first implementation will keep deriving it | business + eng | L | medium | still open |
| HAND-04 | Offer expiry is still literal markup ("expiră în 4 zile"), now on 4 of 30 cards after round 15 thinned the clones — better optics, same absent mechanism | A string implements as a string | business | S | low | still open |
| HAND-05 | Which filter facets are real is still undecided — 6 wired `data-f` facets vs a rail of decorative rows with counts; the pre-checked subset became CONV-17 | Counts imply an availability-backed facet contract; either order it or trim the rail | eng + business | M | low | still open, sharpened into CONV-17 |
| HAND-06 | The confirmation page still states two advances (painted 1 793 vs static 1 214) and two balances (4 182 vs 2 832); the same static pair now also sits in checkout's voucher-assist box (`checkout.html:136`) | The balance is authored in multiple places with no source of truth; this is the page that triggers balance collection | design + eng | S | low | still open, one more surface |
| HAND-07 | Where a homepage offer card leads — **resolved in implementation** (round 16): `.hcard` opens that hotel's page from any surface, click-verified this run. Residual: a campaign card still does not preselect that campaign's rate on the hotel page | The residual is small but real — the campaign context dies at the click | design | S | low | resolved in implementation (residual open) |
| HAND-08 | **The demo panel's defaults are the shipped design, and nobody has recorded them as chosen.** Current defaults: sticky search on×3 · filters Lipită · pin Linie · density A · per-page 30 · rooms-expander Da · session De pe site · photos Prototip. This report's recommendations differ in one place (density → B) and endorse the rest | A switch left at its accidental default ships as silently as a decision; the panel is also the natural experiment-flag register (HAND-02) | design + business | S | low | new |

## Wave 1 — the batch to fix before implementation starts

Selection: cheapest now vs after the build, ordered by how much implementation work each would
otherwise invalidate. All six are `SHIP`, Effort S, no open `Blocked by`.

1. **CONV-07** — bind the benefit strip to the selected rate's policy fields.
2. **CONV-02** — derive both deadlines once; delete all 17 literal/painter sites.
3. **CONV-13** — render quantity and total from one value (with CONV-01's caption slice — same
   occupancy root).
4. **CONV-01 (slice)** — stop naming a party composition the price was not computed for.
5. **CONV-17** — delete the decorative pre-checked filter state; branch test reads real facets only.
6. **CONV-18** — scope the instant-confirmation claim to the model.

**Riding along, not counted:** CONV-16's five `lang()` wraps land in the same painters CONV-02
touches — do them in the same change; CONV-12's smallest slice (two controls in the zero box) is
unblocked the moment CONV-17 lands.

**Sequencing constraints.** The occupancy model (CONV-01 full fix + CONV-13) must be decided before
the offer schema is implemented — unchanged from v2 and now a round older. CONV-17 precedes
CONV-12's remainder. HAND-01 (the checkout form) should be designed before the next review, or that
step ships by default.

**Invariants this batch must not break** — from *What this design gets right*: amount stable tile →
payment; resort tax outside the headline price; no pre-ticked extras; consent separation + gated
CTA; no checkout overlays; stay-bar in-place repricing; request-only rows stay visually distinct;
the session rule on the hotel page; the pager keeps telling the truth; every panel state stays
URL-addressable.

## Strategic recommendations

1. **Answer the three INVESTIGATE rows from production data before the next design round** —
   unchanged from v2, still days of queries: request-only revenue share (CONV-15), priced vs
   unpriced homepage modules (CONV-14), homepage scroll depth (CONV-10). They decide whether the
   biggest structural questions are footnotes or headlines.
2. **Decide the occupancy model before the offer schema** (CONV-01, CONV-13, HAND-01). Third report
   carrying this; it is the most expensive retrofit implied here.
3. **Write the event contract with the panel dimensions in it** (HAND-02 + HAND-08). The panel
   already enumerates the first year's experiment flags; the contract is one workshop away from
   existing.
4. **Ship the truth-defect batch before any new surface.** Rounds 13-16 again added surfaces
   (30-card listings, production photos, sticky chrome) while the four one-day defects aged another
   round. Every new surface inherits them — CONV-16 gained a call site exactly this way.
5. **Run the C flow in production-photo mode as a design gate** before the Figma handoff — the
   instrument exists (`?assets=prod`), costs one click, and the layout has never been formally
   accepted on the real photo base.

## Statistics
- Findings: **0 critical · 7 medium · 4 low**
- Tier: P0 10 · P1 1 · P2 0  |  Class: Blocker 0 · Friction 3 · Leak 8 · Polish 0
- Observation evidence: [OBSERVED] 10 · [CODE] 1 · [CLIENT-CODE] 0 · [DATA] 0 · [PLATFORM] 0 ·
  [RESEARCH] 0 · [HYPOTHESIS] 0
- Mechanism evidence: [DATA] 0 · [PLATFORM] 0 · [CODE] 7 · [RESEARCH] 1 · [HYPOTHESIS] 3 — *no
  row's cost is measured; seven rest on contradictions verified in source, the strongest evidence a
  pre-launch artifact carries; the three judgement rows are INVESTIGATE, not argued.*
- Ordering basis: funnel position
- Decisions: SHIP 8 · SHIP+MEASURE 0 · TEST 0 · INVESTIGATE 3
- Walkthroughs completed: 5  |  Complete price paths tracked: 3
- Legal side-notes handed off: 9  |  Handoff gaps: 8 (1 resolved in implementation)
- Demo-panel options evaluated: 12 of 12 (4 instruments · 8 design decisions; 1 default change
  recommended, 7 endorsed)

## Suggested CLAUDE.md Updates

### Known Issues Updates
- No `critical` findings; keep the pointer to the current audit → update it to
  `docs/audits/conversion-review-report-v3.md` — 7 medium, 4 low; two new mediums (CONV-17
  decorative filter chips, CONV-18 blanket instant-confirmation claim) are v2 misses on unchanged
  code; CONV-12 improved in part; HAND-07 resolved in implementation.

### Conversion Baseline
- Unchanged from v2 except: **instrumentation contract scope grew** — the event contract must also
  reserve the demo-panel dimensions (`card_density`, `page_size`, `pinned_mode`, `sticky_*`) since
  those switches are the first post-launch experiments (HAND-02/HAND-08).

### Funnel Invariants to Protect
All v2 invariants stand (re-verified this run). Add:
- The hotel page's session rule: no search surface for visitors from our own listing; search card +
  docked bar only for cold entries.
- The docked sticky bar is the compressed header — same popovers, same submit handler — never a
  second navigation; absent in export mode.
- The sticky filter column's offset couples to the docked bar via `:has(.ssearch.on)` (74px) — a
  change to either must re-verify the other.
- The pager's range line always matches the number of cards actually in the list.
- Every rendered filter chip corresponds to a facet that changes the visible result set. *(CONV-17)*
- No surface promises instant confirmation for a set that includes request-only inventory.
  *(CONV-18)*
- Every demo-panel state remains URL-addressable through implementation (experiment-flag surface).

## Suggested Memory Updates
- None — no new user preference or correction surfaced this run. (The P0 ruling and the "phone as a
  cost line" stance are already recorded.)
