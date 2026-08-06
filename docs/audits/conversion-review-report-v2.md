# Conversion Review — v2

> **What this report is.** The audited artifact is a **clickable design prototype**, not a running
> shop. The question it answers is therefore: *of the decisions this design has already made, which
> ones will cost money once they are built — and which correct ones would a later cleanup destroy?*
> It is not "what is missing from the prototype".
>
> Everything that is mockup scaffolding — static form fields, seeded data, placeholder counters,
> half-wired links, absent analytics, no backend, no payment integration — is **out of scope as a
> finding** and collected separately under *Handoff gaps*.
>
> **Language note:** v1 was written in Polish. The toolkit's repository-language policy now requires
> repository-facing artifacts in English, so v2 is in English. No other convention changed.

## Audit metadata
- **Date:** 2026-07-29 20:54:15
- **Environment audited:** local static prototype — `http://localhost:8080` (`node tools/serve.js`)
- **Artifact maturity:** **PROTOTYPE** — decided by check, not by asking. Signals: no backend
  persists an order · no payment integration · no tracking layer of any kind (zero `dataLayer` /
  `gtag` / `track(` call sites in `proto.js` or `proto-m.js`) · all inventory is seeded literals ·
  README describes the repo as a redesign prototype · deployment is a static GitHub Pages host.
  Six of six negatives.
- **Implementation repo:** `desktop-redesign` — branch `main`, commit `889ccac`
  ("Give the hotel page the right bar for the right visitor"). Tree clean except untracked `docs/`.
- **Reviewer:** Claude (conversion-review skill)
- **Toolkit version:** 1.29.0
- **Evidence mode:** **HEURISTIC** — by construction, not by lack of access. No traffic, no
  analytics, no orders exist. **No reach figure in this report is measured, and none is guessed
  either**; ranking uses funnel position (see *Ordering basis*).
- **Out of scope by artifact maturity:** seeded prices and inventory counts, placeholder facet
  counts, static `.inp` form fields, unwired card links, absent analytics, no backend, no payment
  integration, no transactional email, hardcoded demo identity ("Ana Ionescu").
- **Data window & sources:** none.
- **Ordering basis:** **funnel position** (entry → discovery → evaluation → decision → checkout →
  payment → post-purchase), with the high-value-shape exception applied and stated per row.
- **Denominator:** not applicable — no sessions exist.
- **Target surface:** **both** — desktop 1440×900 and mobile web 390×844. Each finding names the
  surface it was confirmed on.
- **Derived KPI tree (P0 corrected by the user during preparation):**
  **P0 = a paid booking completed online** (30% advance or payment in full) on own charter
  inventory. The user explicitly ruled that **the call centre is not a parallel P0 path**: the phone
  is a cost to reduce, not a conversion. Every hand-off to `0241 999` is therefore scored as a leak
  unless no online path could exist.
  **Micro-conversions:** search performed → results seen → hotel opened → rate selected → checkout
  started → payment attempted → confirmation.
  **P1, re-ordered by me to follow the corrected P0** (inference — the user corrected P0 only):
  call-centre contacts per 100 bookings → share paid in full up front → cancellation rate → AOV →
  FRIENDS enrolment → marketing consents.
- **KPI tree confirmed by the user:** P0 **yes** (corrected). P1 ordering **no** — proceeding on my
  inference, marked above.
- **Markets walked:** RO (primary) + EN twins. **Devices:** desktop 1440×900, mobile 390×844
  (unthrottled — no throttling available).
- **Auth / consent states walked:** guest only. No consent layer exists in the prototype.
- **Payment step coverage:** **not exercised** — no payment integration exists. Every
  authorization, 3-D Secure, decline and unpaid-recovery check is NOT CHECKED.
- **Source access:** full repo. All code anchors are first-party.
- **Assumptions:** the P1 ordering above; that `desktop-redesign` is the repo where fixes land.
- **Review scope:** user-set — **C/D flow, desktop + mobile, RO + EN**. Variants A and B excluded.
  Cluster A (measurement) **not run as findings** — see *Measurement readiness*; consequence: no
  reach figure is validated and ordering falls to funnel position.
- **Session split:** single session.
- **Side effects created:** none. Local static prototype; `localStorage` only, cleared at start.
- **Analytics pollution:** none possible.
- **Bot-protection events:** none.
- **Walkthroughs completed:** 4 · **complete price paths tracked:** 3
- **NOT CHECKED (blind spots):** variants A and B · `listing-b` · `m-thankyou` beyond a date check ·
  the consultant/callback path end to end · the two-step gallery, UGC upload and review-submission
  modals (round 10) · the sticky-search and pinned-card demo switches (round 12) beyond confirming
  they do not shift layout · promo codes and voucher split · everything behind a payment control ·
  performance, caching, availability revalidation, time zones · review authenticity and ranking
  disclosure (no data, no backend).

## Source boundary
- **Planning authority:** **sourceable**, pending the detached ingress receipt. The prototype repo
  *is* the implementation repo — every finding below carries a first-party code anchor and its fix
  is a code change in this repo.
- **Implementation source:** `litro-desktop-redesign` / component `prototype`, canonical snapshot
  `sha256:4c3a44ef001d21860db08980b9b7412a95811915e52bc3e64fde0a2fb08ef9f6`, captured at `889ccac`
  with `docs/audits` and `node_modules` excluded, verified `complete` before finalisation.
- **External build/release identity:** not applicable — no release exists.
- **Planned graph IDs:** this run initialises the graph (`expected_graph_heads: GENESIS`).
  `CONV-nn` is a producer key, never a case ID.
- **First observed:** v1 predates the lineage graph and was never ingested, so the graph's earliest
  observation for **every** case below — including the five carried from v1 — is this run. The
  *report* history is stated per row in **Status**; do not read graph age as finding age.
- **Detached receipt:** generated after the report bytes are final, stored outside the report body.
- **State boundary:** code `observed at 889ccac` · evidence `observed + source-verified` ·
  integration `not evidenced` · deployment `not evidenced` · live/release `not evidenced`.

## Change dashboard

| Metric | v1 | v2 | Delta | Trend |
|---|---|---|---|---|
| Critical / Medium / Low | 2 / 2 / 1 | 0 / 5 / 4 | — | see note |
| Blockers | 1 | 0 | −1 | ↓ |
| Rows with a measured mechanism | 0 | 0 | 0 | → |
| Evidence mode | HEURISTIC | HEURISTIC | — | — |
| Artifact mode | PROTOTYPE | PROTOTYPE | — | — |

**Counts are not comparable across versions and the trend arrows are nearly meaningless here.** Two
things changed that have nothing to do with the product: the scope roughly doubled (mobile and EN
did not exist at v1), and this toolkit version forbids `critical` on a row whose *mechanism* rests
on judgement — which, in a pre-launch artifact with no traffic, is most rows. v1's two criticals are
not "fixed"; they are the same defects, re-scored under a stricter rule. See *Audit accuracy*.

### Status flow

| Status | Count | Findings |
|---|---|---|
| observed — persists | 1 | CONV-01 |
| observed — worsened | 4 | CONV-02, CONV-07, CONV-10 (home-c only), CONV-12 |
| not_observed_at_ref | 0 | — |
| regression | 0 | — |
| unresolved / deprioritized | 0 | — |
| new — unchanged code (v1 miss or re-scored) | 3 | CONV-13, CONV-15, CONV-16 |
| new — changed code | 1 | CONV-14 |

Every row above is observational. Nothing here is `fixed`, `resolved` or `accepted-risk`; only a
valid `/impl-verify` flow can close a case.

**None of v1's five findings were addressed.** Between `ca5dbf0` (v1) and `889ccac` (v2) the repo
took **61 files changed, +9 144 / −172** — mobile web, EN twins, the two-step gallery, UGC, sticky
search, the pinned carousel card, hotel session states. Substantial work; zero of it touched the
five findings. Four of the five are now worse, and one of the new bands is why.

### Audit accuracy — where v1 was wrong

An audit that never records its own misses cannot be trusted on the numbers it ranks by.

1. **CONV-13 is a v1 miss, not new code.** `proto.js:1866` (`S.rooms + ' × ' + S.rate`) is present
   verbatim at `ca5dbf0`. v1 built a price-tracking table whose path B *was* the multi-room case —
   and stopped it at the hotel page, leaving the booking-bar and checkout cells as "—". The defect
   lives one step past where v1 stopped. **Method lesson: a truncated price path is not a price
   path**; all three paths in v2 run to checkout.
2. **v1's fold arithmetic on home-d was wrong.** v1 published "74% of the first viewport is chrome
   and marketing", counting the 243px search hero as chrome. On a step whose next micro-conversion
   *is* search, the search hero is the CTA. Recomputed honestly: 416px (46%) is chrome; the hero is
   a separate 243px (27%). The finding survives on home-d's own thesis, but the published number
   overstated it by 28 points.
3. **CONV-15 is a reclassification, not a discovery.** v1 saw the request-only rate rows and listed
   them under *what the prototype does right*. That was correct under v1's KPI tree, which treated
   the call centre as a parallel P0 path. The user's correction inverts it. v1 was not wrong on the
   evidence; it was ranking against a tree the business has since rejected.
4. **Effort grades:** no v1 finding was re-graded by more than one step.

## Product classification & area verdicts
- **Class:** travel marketplace operating on own charter inventory (agency as organiser)

| Area | Verdict | Note |
|---|---|---|
| 1–5. Measurement & activation | N/A | no instrumentation exists — see *Measurement readiness*, HAND-02 |
| 6. Entry intent & continuity | needs improvement | CONV-10 |
| 7. Search, filters, relevance | needs improvement | CONV-01 |
| 8. Dead ends & recovery | problem | CONV-12 |
| 9. Speed & stability | N/A | no backend |
| 10. Viewport economics | needs improvement | CONV-10, CONV-14 |
| 11. Detail page as decision support | needs improvement | CONV-01, CONV-14 |
| 12. Offer integrity (availability & price) | problem | CONV-13, CONV-01 |
| 13. Terms as decision inputs | problem | CONV-07, CONV-02 |
| 14. Social proof authenticity | N/A | seeded review data, no backend |
| 15. Claims, defaults, dark patterns | problem | CONV-07 |
| 16. Total price transparency | OK | amount stable on all 3 paths — protect |
| 17. Forward momentum & defaults | needs improvement | CONV-07 |
| 18. Checkout structure & state | needs improvement | CONV-13; form itself unbuilt (HAND-01) |
| 19. Form friction & guest checkout | N/A | no form exists to audit — HAND-01 |
| 20. Commit-step copy integrity | needs improvement | CONV-16, CONV-02 |
| 21. Payment methods & authorization | needs improvement | CONV-15; rest not exercised |
| 22. Promo & reference-price integrity | N/A as finding | reference price derived from the badge — HAND-03 |
| 23. Purchase-path accessibility | N/A | no real inputs to test — HAND-01 |
| 24. Add-ons & upsell | OK | no pre-ticked paid extras anywhere — protect |
| 25. Abandonment recovery & lead capture | N/A | no backend, no email |
| 26. Post-purchase & repeat purchase | needs improvement | balance stated twice — HAND-06 |
| 27. Post-conversion lifecycle | needs improvement | CONV-02 (balance deadline) |
| 28. Marketplace supply & liquidity | needs improvement | CONV-15 |

## Measurement readiness

Cluster A is **not audited as findings** in PROTOTYPE mode — there is no instrumentation to audit,
and five guaranteed absences at the top of a report would set its frame falsely. One paragraph
instead, filed as **HAND-02**:

The designed flow will need, at minimum: `search_performed` (destination, dates, party shape,
rooms), `results_seen` (count, whether the empty state rendered and on which branch),
`hotel_opened`, `rate_selected` (rate id, refundable yes/no, online vs request-only),
`checkout_started`, `payment_attempted`, `booking_confirmed` (advance vs full). Two of those
dimensions do not exist in any conventional schema and are the whole point here: **`online` vs
`request-only`** on every rate event, and **`variant` (C / D)** on every event. Without the first,
the corrected KPI tree cannot be measured at all — the business has just declared that phone
bookings are a cost, and nothing currently distinguishes them. Without the second, the C-vs-D
question can never be settled by evidence. An event contract is a genuine design deliverable and is
an order of magnitude cheaper to specify now than to retrofit.

## Funnel snapshot

No traffic exists; this is the shape only, with no volumes.

| Step | Route / surface | Main leak found |
|---|---|---|
| Entry | `home-c`, `home-d`, `m-home` | first priced offer at y=2452 (C) / one card visible (D) — CONV-10, CONV-14 |
| Discovery | `listing-c`, `m-listing` | party shape not priced or named — CONV-01; dead end offers only a phone — CONV-12 |
| Evaluation | `hotel`, `m-hotel` | false cancellation + payment promise — CONV-07; frozen deadlines — CONV-02 |
| Decision | rate table | 2 of 7 rate rows, both premium, cannot be booked online — CONV-15 |
| Checkout | `checkout`, `m-checkout` | summary states N rooms at one room's price — CONV-13; RO strings on EN — CONV-16 |
| Payment | — | not exercised, no integration |
| Post-purchase | `thankyou`, `m-thankyou` | balance stated twice with different values — HAND-06 |

## Executive summary

The prototype's money arithmetic is sound — the amount a customer is shown holds from result tile to
payment on all three price paths, the resort tax is correctly excluded and named, no paid extra is
pre-ticked, and the purchase consent genuinely gates the CTA. What is not sound is everything the
customer is told *around* that amount: the free-cancellation deadline and the balance-due date are
frozen literals that read "20 May" and "22 May" for a September stay; the booking card promises free
cancellation and "you pay nothing now" over a rate the same table calls non-refundable and
pay-in-advance, and keeps promising it after the customer explicitly selects that rate; and the
checkout invoices "2 × Cameră dublă" at the price of one. None of these are seeded-data artifacts —
each is a line of code that will ship exactly as written.

The single largest structural finding follows from the user's correction to the KPI tree. With the
call centre no longer counted as a P0 path, the design's phone hand-offs stop being a feature and
become the leak: **the two highest-priced rate rows on the hotel page cannot be booked online at
all**, and the no-availability dead end offers a phone number as its only control. That is the
company's own charter stock, routed to a line open 10:00–18:00. Sizing it is the one thing this
report cannot do and LITRO's order data can, which is why it is `INVESTIGATE` rather than a
recommendation — the answer decides whether it is the most important row here or a footnote.

Between v1 and v2 the team shipped roughly nine thousand lines across sixty-one files and did not
touch any of v1's five findings; four are now worse. The sequencing recommendation is therefore
unchanged in substance and blunter in form: fix the four small, self-contained truth defects
(CONV-07, CONV-02, CONV-13, CONV-16) before adding another surface, because every surface added
since v1 has duplicated them — mobile and EN now carry the same wrong dates and the same false
promise, which is why two of them got worse rather than staying still.

## What this design gets right

Recorded first and deliberately, because these are easy to destroy while fixing the rest. Every
line here is repeated verbatim in *Funnel invariants to protect*.

- **The amount is stable from result tile to payment.** Three complete price paths, no drip pricing,
  no fee appearing late. Breaking it would cost more than every finding in this report combined.
- **`Taxa de stațiune` is excluded from the headline price and named as payable at the hotel**, on
  every surface including mobile and EN. This is the correct treatment and it is easy to lose.
- **No paid extra is pre-ticked** anywhere in the C/D flow, on either surface.
- **Purchase consent is separated from marketing consent**, marketing is labelled optional and
  carries a withdrawal right, and the CTA is genuinely gated — `btn-disabled` until the purchase
  consent is ticked, verified on desktop and mobile.
- **No overlay fires on a checkout route.**
- **The stay bar edits dates and guests in place on the hotel page**, repricing without a round trip
  to search. This is a good and uncommon decision.
- **Request-only rows are visually separated from instantly-confirmable ones.** CONV-15 argues the
  business model behind them should change; it does not argue for hiding the distinction. If the
  online path is fixed, keep the honesty.
- **The advance is editable within a stated minimum and maximum**, on both surfaces.
- **Confirmation documents carry real state** — issued vs pending, with the reason — instead of
  pretending everything is ready at once.
- **Own inventory is badged and explained**, with a modal that says what "guaranteed by us" means.
  CONV-14 argues the badge must not replace the price; the badge itself is right.

## Legal side-notes — non-blocking, for `/legal-review`

Nothing in this table is work, none of it is ranked, and this report takes no position on any of it.

| Behaviour | Where | Also reported as | Likely direction if remedied |
|---|---|---|---|
| An unconditional "free cancellation" and "you pay nothing now" rendered over a rate the same table labels non-refundable and pay-in-advance | `hotel.html`, `hotel-en.html`, `m-hotel.html`, `checkout.html` | CONV-07 | Positive — removes the dispute source as well as the contradiction |
| A stated cancellation deadline that has already passed for the stay being sold, printed beside the correct rule in the same sentence | `checkout.html:173` and the hotel pages | CONV-02 | Positive — the correct date gives the customer *more* flexibility than the one shown |
| An order summary stating a quantity the total does not cover | `proto.js:1866` | CONV-13 | Neutral to positive — resolves in the customer's favour either way |
| A unit sold to a party larger than the capacity its own description declares | `m-hotel.html:147` vs the booking flow | CONV-01 | Neutral — may reduce completions for oversized parties, which is the point |
| The struck-through reference price is computed from the discount badge (`total / (1 − disc)`), so no stored 30-day low can exist | `proto.js:556`, `proto-m.js:207` | side-note only (HAND-03) | Likely negative for headline discount optics; unavoidable if reference prices are kept |
| Countdown text ("expiră în 4 zile") is a hardcoded string with no campaign end date behind it | `listing-c.html:294`, `home-b.html:246`, `home-d-en.html:420` | side-note only (HAND-04) | Neutral — LITRO's programmes really do expire, so an honest version exists |

Six side-notes against nine findings. That is a normal ratio and does not indicate this product needs
`/legal-review` more than it needed this report — but the first two rows engage consumer-protection
rules on misleading information, and both are worth putting in front of counsel before launch rather
than after.

## Findings

Ordered by Tier → Class → funnel position → Effort, exactly as the ordering rule requires.
**Row order and Severity deliberately diverge**: severity is derived from Tier + Class + the
mechanism demotion, while order is driven by class and funnel position. An entry-step `Leak` sits
above a checkout-step `Leak` because everyone who reached checkout passed the entry. `/impl-guide`
filters on **Severity**, not on row order.

| ID | Area | Finding | Tier | Severity | Status | Step | Reach | Class | Evidence | Effort | Decision | Location |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CONV-01 | 7, 11, 12 | Party shape is neither priced nor named: the prototype's own default search (2 adults + 2 children + 2 rooms) is captioned "2 adulți" at a single-room price, and the room's own declared capacity is never compared to it | P0 | medium | observed — persists | discovery | n/a — ranked on high-value shape (family / multi-unit), not step | Friction | [OBSERVED]/[CODE] | M | SHIP | `proto.js:64`, `:567`, `stayTotal()`; `m-hotel.html:147,229` |
| CONV-15 | 21, 28 | The two highest-priced rate rows (2 of 7) cannot be booked online at all — own charter stock routed to a phone line open 10:00–18:00 | P0 | low | new — unchanged code (re-scored) | decision | n/a — ranked on high-value shape (top price band), not step | Friction | [OBSERVED]/[HYPOTHESIS] | L | INVESTIGATE | `hotel.html` `tr.rate-request` ×2; `hotel-en.html`; `m-hotel.html` |
| CONV-14 | 10, 11 | "Hoteluri garantate de noi" — the band carrying LITRO's strongest asset — puts a trust claim in the price slot and shows no price, while the identical component 500px below is priced | P0 | low | new — changed code | entry | n/a — funnel position (entry) | Leak | [OBSERVED]/[HYPOTHESIS] | S | INVESTIGATE | `home-c.html:298-330` `.price-note`; `m-home.html` same band |
| CONV-10 | 6, 10 | Neither homepage variant reaches its own thesis in the first viewport: home-d shows one offer card, home-c puts ~1 460px of unpriced sections between the search and the first price | P0 | low | observed — worsened (home-c) / persists (home-d) | entry | n/a — funnel position (entry) | Leak | [OBSERVED]/[HYPOTHESIS] | M | INVESTIGATE | `home-c.html` section order; `home-d.html` `.listing-grid` |
| CONV-12 | 8 | The dead end is caught but not diagnosed: the filtered branch offers only clear-**all**, and the no-availability branch offers no control at all — its sole interactive element is the phone number | P0 | medium | observed — worsened | discovery | n/a — funnel position (discovery) | Leak | [CODE]/[RESEARCH] | S | SHIP | `proto.js:1245-1267` |
| CONV-07 | 13, 15, 17 | The booking card promises "Anulare gratuită" and "Nu plătești nimic acum" over a rate the same table labels "Nerambursabil · plată în avans" — and keeps promising it after that rate is explicitly selected | P0 | medium | observed — worsened | evaluation | n/a — funnel position (evaluation) | Leak | [OBSERVED]/[CODE] | S | SHIP | `hotel.html:136,139`; `hotel-en.html`; `m-hotel.html`; `checkout.html` |
| CONV-02 | 13, 20, 27 | Every cancellation and balance date is a hardcoded literal, so both are wrong for every stay except the demo one — and desktop and mobile checkout now print different deadlines for the same booking | P0 | medium | observed — worsened | evaluation | n/a — funnel position (evaluation) | Leak | [OBSERVED]/[CODE] | S | SHIP | `hotel.html`×4, `checkout.html:173`, `m-hotel.html:191`×3, `m-checkout.html`, `proto.js:1852,2029,2048`, `proto-m.js:1771,1916` |
| CONV-13 | 12, 16, 18 | The checkout summary multiplies the room name by the searched room count while the total covers one room — "2 × Cameră dublă" at 5 975 Lei, the one-room price | P0 | medium | new — unchanged code (v1 miss) | checkout | n/a — funnel position (checkout) | Leak | [OBSERVED]/[CODE] | S | SHIP | `proto.js:1866` |
| CONV-16 | 20 | On the EN checkout the product name, board basis, night count and the entire balance-payment instruction render in Romanian — the mobile engine already translates the same strings | P1:full-prepayment share | low | new — unchanged code (v1 blind spot) | checkout | n/a — funnel position (checkout) | Friction | [OBSERVED]/[CODE] | S | SHIP | `proto.js:1852,1864,1867,2048` vs `proto-m.js:1771,1916` |

`CONV-nn` is the stable producer key across report versions, not a canonical case ID. The detached
ingress receipt maps each key to its canonical case and observation.

## Findings detail

### CONV-01 — The party the product is built for is the one it cannot price

- **Repro:** `http://localhost:8080/home-c.html` → *Caută* with the untouched default search
  (Tot litoralul, 5–12 iun, **2 adults + 2 children + 2 rooms**) → `listing-c.html` → any card →
  `hotel.html` → *Adaugă cameră* → `checkout.html`. Desktop 1440×900 and mobile 390×844, RO and EN,
  guest.
- **Markets / surface confirmed in:** RO + EN · desktop **and** mobile.
- **What happens.** `proto.js:64` sets the prototype's default search to `adults: 2, kids: 2,
  ages: [7, 11], rooms: 2`. Every listing card is then captioned `S.adults + ' adulți, ' + n +
  ' nopți'` (`proto.js:567`) — "2 adulți" — and priced by `stayTotal(base, from, to)`, which takes
  no occupancy argument at all. The two children and the second room enter neither the caption nor
  the price. On mobile the contradiction is on one screen: the summary reads "**4 pers. · 2 camere**"
  directly above six cards each reading "**2 adulți**". On the hotel page three different statements
  of the same party coexist at the same 5 975 Lei — stay bar "2 adulți + 2 copii · 2 camere",
  booking card "1 × Cameră dublă · 2 adulți", booking bar "**1 camere · 2 adulți + 2 copii**".
- **Why it costs conversion.** This is not a guess about behaviour: `m-hotel.html:147` declares the
  double room's capacity as "**max. 2 adulți + 1 copil**", and the flow prices and sells that room
  to a party of four — so the business is either re-accommodating at reception at its own cost or
  refusing a check-in it confirmed. That the numbers are seeded is irrelevant; the design has no
  step at which the declared capacity is compared to the searched party.
- **What changed since v1.** v1 found the same defect and proposed, as its smallest slice, changing
  the caption to name the priced unit. Not applied. But v1's stated fix — "decide unit capacity and
  the room multiplier in the offer model" — is now known to be too big: **the capacity is already
  written down**, as prose in `.rmeta` (`m-hotel.html:147,229`). Nothing reads it.
- **Fix.** Promote the capacity string to a field on the unit; compare it to the searched party at
  the point the card is rendered; design the "this party does not fit this unit" state on the card
  and on the hotel page. Until the arithmetic exists, no caption may name a party composition that
  was not priced — "de la X Lei / cameră" instead of "2 adulți".
- **Smallest shippable slice:** the caption alone (`proto.js:567`, and the mobile equivalent). One
  string, removes the false claim immediately; the occupancy model is the remainder (Effort M).
- **Card type:** implement.
- **Definition of Done must include:** no price caption names a party composition the price was not
  computed for; a party exceeding a unit's declared capacity cannot reach checkout silently.
- **Blocked by:** none.

### CONV-15 — The most expensive inventory has no online path

- **Repro:** `hotel.html` (any state) → rate table. Two rows carry `tr.rate-request`. Desktop and
  mobile, RO and EN.
- **Markets / surface confirmed in:** RO + EN · desktop and mobile.
- **What happens.** Of 7 rate rows, 5 are bookable online and **2 are not**: "All inclusive premium ·
  vedere frontală la mare" and "Apartament premium · 2 balcoane, vedere mare". Both are top-of-ladder
  rooms. Both are described as own stock — "verificăm disponibilitatea în **inventarul propriu**" —
  and both terminate in "Cere prin consultant". The phone line is open 10:00–18:00.
- **Why it costs conversion.** Under the KPI tree the user confirmed during preparation, P0 is a
  booking *completed online*. These rows have no online path, so their P0 contribution is zero by
  construction — and they are the rows with the highest AOV. This is a business-model decision that
  the redesign inherits rather than a coding defect, which is exactly why it belongs in this report
  once the phone stopped counting as a conversion.
- **What we would have to believe.** That the revenue currently taken by phone for these room types
  is large enough to justify designing an asynchronous online path (request-to-book with a held
  price, or a bookable callback slot) rather than leaving them as a phone product. **This is
  measurable in LITRO's existing order data today** — share of bookings and of gross revenue for
  request-only room types, and how many of those arrive outside 10:00–18:00. A week of that query
  settles it. If the share is small, this row is a footnote and should be closed as such; if it is
  large, it outranks everything else in this report. I am not able to tell which from the prototype,
  and estimating it would be inventing the number this report exists to avoid.
- **Exchange rate vs P0:** an online async path converts some share of request-only demand that
  today either calls or leaves; against it, an online request that is later declined costs a
  confirmed-booking expectation and a support contact. Break-even cannot be stated without the
  volume above — the inequality is: *(request-only revenue × online capture rate) > (decline rate ×
  cost of a broken confirmation)*, with both rates unknown.
- **Definition of Done must include:** P0 conversion overall must not fall; the share of bookings
  originating outside call-centre hours is the metric this is meant to move.
- **Blocked by:** HAND-02 — without an `online` vs `request-only` dimension on the rate events, this
  cannot be measured after launch either.

### CONV-14 — The strongest asset is the one thing shown without a price

- **Repro:** `home-c.html` at 1440×900 and `m-home.html` at 390×844, guest, RO.
- **Markets / surface confirmed in:** RO (EN twin carries the same markup) · desktop C and mobile.
- **What happens.** The band "Hoteluri garantate de noi" renders four `.hcard[data-own="1"]` cards.
  Each card's `.price-block` contains no price — only
  `<div class="price-note">Alocare proprie · confirmare instantanee</div>` (`home-c.html:298-330`).
  The band is 519px on desktop and 487px on a 844px phone. **The identical component 500px below,
  in "Oferte Înscrieri Timpurii 2026", is fully priced** — so this is a deliberate substitution of a
  claim for a number, not a missing feature. home-d does the opposite and does it well: its own
  inventory is priced `.lcard[data-own="1"]` with the badge alongside the price.
- **Why it costs conversion.** The band's own copy is the strongest commercial argument LITRO has —
  own allocation, real availability, instant confirmation, changeable without the hotel. Placed
  where the price should be, it cannot be compared with anything, and the only way forward is a
  filter link that restarts discovery. On a product whose differentiator is that the inventory is
  real, the section that says so is the one that will not say what it costs.
- **What we would have to believe.** That an unpriced module loses more entries to the funnel than a
  priced one gains in trust framing. The cheapest evidence is the **live** site's existing
  click-through on priced versus unpriced homepage modules — LITRO has that today. If unpriced
  modules already out-click priced ones on production, this row is wrong and should be dropped.
- **Fix.** Show the price. home-d already demonstrates the pattern — badge and price on the same
  card — so this is a component swap, not a design question.
- **Smallest shippable slice:** replace `.price-note` with the priced `.price-block` used by the
  section below, on `home-c.html` only. Mobile is the remainder.
- **Card type:** data-collection first — question: do priced homepage modules out-click unpriced ones
  on the live site? Then implement.
- **Definition of Done must include:** P0 conversion must not fall; entries to the funnel from the
  homepage own-inventory band is the metric this is meant to move.
- **Blocked by:** none.

### CONV-10 — Neither homepage variant reaches its own thesis above the fold

- **Repro:** `home-c.html` and `home-d.html` at 1440×900, demo panel is `position: fixed` and does
  not affect flow. Measured with `getBoundingClientRect()`.
- **What happens.**
  - **home-d**, whose stated thesis is *the homepage is the listing*: first `.lcard` at **y=663**,
    278px tall, so exactly **one** offer is visible in a 900px viewport. Above it sit 416px (46%) of
    chrome — promobar 38, header 66, campaign carousel 210, listing head 46, gaps 56 — plus the
    243px search hero, which is **not** counted as chrome because search is this step's next
    micro-conversion. Unchanged from v1 (v1 also measured y=663; v1's published "74% chrome"
    wrongly included the hero — see *Audit accuracy*).
  - **home-c**: first priced offer at **y=2452**, against **y=1803** at v1 — **649px worse**.
    Between the search hero (ends y=595) and the first price sit five unpriced sections totalling
    ~1 460px: "Inspiră-te" 290, "Căutările tale recente" 175, "Rezervă la noi!" 324, an account
    band 150, and the own-inventory band 518 (CONV-14 — new since v1, and the largest single
    contributor to the regression).
- **Why it costs conversion.** For home-d the argument is internal: a homepage that is a listing and
  shows one row is not yet the thing it claims to be, and the choice between C and D is currently
  being made on preference rather than on either variant's best version. For home-c the finding is
  narrower and I want to be explicit about it — **it is not "no offers above the fold"**, which on a
  search-led homepage would be a manufactured leak. It is that the section order places four
  marketing and account bands ahead of the first bookable, priced offer.
- **What we would have to believe.** That homepage scroll depth on the live site drops off before
  1 460px of unpriced content is cleared. LITRO's existing analytics answer this directly, for the
  current homepage, this week.
- **Fix.** home-c: move the priced offer block above "Inspiră-te", "Rezervă la noi!" and the account
  band — trust and inspiration content belongs *after* the product. home-d: the campaign carousel
  and the search hero cannot both own the first viewport; target two full cards at 900px.
- **Smallest shippable slice:** section reorder in `home-c.html` — pure markup, no new components,
  and it is the larger of the two gaps.
- **Card type:** data-collection first — question above; then implement.
- **Definition of Done must include:** P0 conversion must not fall; at 1440×900 at least two priced
  offer cards are at least partly visible in the first viewport of both variants.
- **Blocked by:** none.

### CONV-12 — The dead end is caught, then handed to the phone

- **Repro:** `listing-c.html`, apply filters until zero results; and the no-availability branch at
  `proto.js:1245-1267`.
- **What happens.** Two branches. **Filtered to zero:** "Niciun rezultat pentru filtrele alese" +
  a `[Șterge filtrele]` button that clears **every** filter + the phone number. It does not name
  which facet emptied the result, and offers no way to drop only that one. **No availability for the
  dates:** copy invites the user to "try other dates from the strip below, or a nearby resort" — and
  renders **no button at all**. The only interactive element is `0241 999`.
- **Why it costs conversion.** Clearing every filter to escape one bad filter discards the user's
  whole expressed intent, so the realistic next steps are leaving or calling. On the
  no-availability branch the design does not even offer the first: it names two recovery routes in
  prose and surfaces neither as a control, leaving the phone as the sole action. Under the corrected
  KPI tree that is the cost centre being made the default exit — and the flexible-date strip this
  copy refers to already exists in the codebase and is already rendered on this template when
  results are few.
- **What changed since v1.** v1 recorded the filtered branch only. The no-availability branch is
  worse and was not previously described.
- **Fix.** Name the blocking facet and offer removal of exactly that one; render the existing
  flexible-date strip and nearby resorts with counts as actual controls on both branches; the
  consultant becomes the third option, not the first.
- **Smallest shippable slice:** render the existing flexible-date strip in the no-availability
  branch. It is already built and already used elsewhere on this template.
- **Card type:** implement.
- **Definition of Done must include:** P0 conversion must not fall; every dead-end state offers at
  least one in-product recovery control before it offers a phone number.
- **Blocked by:** none.

### CONV-07 — A free-cancellation promise printed over a non-refundable rate

- **Repro:** `hotel.html` (also `hotel-en.html`, `m-hotel.html`), guest, no rate selected — then
  repeat after clicking *Adaugă cameră* on the "Înscrieri Timpurii 2026 · −15%" row.
- **Markets / surface confirmed in:** RO **and** EN · desktop **and** mobile.
- **What happens.** With nothing selected the booking card reflects the first rate row —
  "Înscrieri Timpurii 2026 · −15%", which the table itself labels "**Nerambursabil · plată în
  avans**" — and renders above it "**Nu plătești nimic acum · confirmare instantă**" and
  "**Anulare gratuită până la 20 mai**". The EN twin says "You pay nothing now" and "Free
  cancellation until 20 May" over "Non-refundable · pay in advance". At checkout the same booking
  carries a green "Anulare gratuită" strip while the CTA reads "Rezervă și plătește **avansul** →"
  and asks for 1 793 Lei.
- **Why it costs conversion.** The mechanism is an obligation mismatch, verified in source rather
  than assumed from behaviour: the promise is rendered from a template that never consults the
  selected rate's policy fields, so for **every** customer who takes the cheapest, default-reflected
  rate the two most important purchase conditions are stated falsely. The business then either
  honours a free cancellation it did not price, or refuses one it displayed — and both resolve
  through the call centre this redesign exists to relieve.
- **What changed since v1 — and why v1's fix would not have worked.** v1 proposed, as its smallest
  slice, not rendering the benefit bar until a rate is selected. **Verified this run: the promise
  survives explicit selection of the contradicting rate.** The bar is not a default-state artifact;
  it is unbound. Any fix must read the rate's own policy fields.
- **Fix.** Bind the benefit strip and the payment note to the selected rate's policy fields, and
  render nothing where no rate is selected. Do not default-reflect a rate that carries cancellation
  conditions — show refundable and non-refundable side by side with the price difference stated.
- **Smallest shippable slice:** bind the two lines to the reflected row's own policy fields. One
  function, no table redesign, fixes desktop and mobile together if applied in the shared painter.
- **Card type:** implement.
- **Definition of Done must include:** P0 conversion must not fall; no cancellation or payment-timing
  promise renders anywhere without a selected rate, and every such promise agrees with that rate's
  own policy fields on all four surfaces (desktop/mobile × RO/EN).
- **Blocked by:** none.

### CONV-02 — Both deadlines are frozen literals, so both are wrong

- **Repro:** `hotel.html?from=2026-09-10&to=2026-09-17` → the page still reads "Anulare gratuită
  până la **20 mai**". Then `checkout.html` with the same dates → "Restul de 3 717 Lei — online până
  la **22 mai**". Confirmed on all three price paths.
- **Markets / surface confirmed in:** RO **and** EN · desktop **and** mobile.
- **What happens.** Nothing derives either date from the stay. Census:
  `hotel.html` ×4 and `m-hotel.html` ×3 say "20 mai"; `checkout.html` ×1 says "20 mai";
  `proto.js:2029` (conditions modal) says "26 mai"; `thankyou.html` ×4 and `m-thankyou.html` say
  "26 mai"; the balance date "22 mai" is hardcoded at `proto.js:1852`, `proto.js:2048`,
  `proto-m.js:1771` and `proto-m.js:1916`. The EN twins mirror it exactly. For the demo stay
  (check-in 5 June) the correct value under LITRO's own rule — request at least 10 days before
  check-in — is **26 May**, so the two most-visited surfaces carry the wrong one, and
  `checkout.html:173` prints the wrong date and the correct rule in a single sentence:
  "Anulare gratuită până la 20 mai (cu 10 zile înainte de check-in)".
- **Why it costs conversion.** Verified in source, not assumed: because the dates are literals, a
  customer booking a September stay is told their free-cancellation window closed on 20 May and
  their balance was due on 22 May — both months before they booked. Flexibility is a purchase
  condition in this model, and the design states it in a way that is false for every stay except the
  demo one.
- **What changed since v1 — the finding is materially worse than "three different strings".**
  Three things v1 could not see: (a) the same defect governs the **balance-due** date, not only
  cancellation; (b) the date is not merely inconsistent but *frozen*, so it is wrong for essentially
  every real booking rather than for two screens out of three; (c) desktop and mobile checkout now
  **disagree** — `m-checkout.html` prints the correct "26 mai" where `checkout.html` prints "20 mai",
  so one customer switching device sees two deadlines for one booking.
- **Fix.** One derived value each, computed once and bound everywhere: free-cancellation deadline =
  `check-in − 10 days` at 23:59 (the confirmation page already implies this), balance deadline =
  the single rule the business actually applies. Delete every literal.
- **Smallest shippable slice:** compute the cancellation date once and bind the five desktop call
  sites; mobile and the balance date are the remainder.
- **Card type:** implement.
- **Definition of Done must include:** P0 conversion must not fall; changing the stay dates moves
  every rendered cancellation and balance date on every surface, and all surfaces show one value.
- **Blocked by:** none.

### CONV-13 — The checkout invoices two rooms at the price of one

- **Repro:** search with **rooms = 2** (the prototype default) → hotel → *Adaugă cameră* on one row
  → `checkout.html`. Summary reads "**2 × Cameră dublă vedere mare**"; total reads **5 975 Lei**,
  which is the one-room price carried unchanged from the listing tile and the booking bar. With
  `rooms=1` (price paths B and C) the line correctly reads "1 ×" — so the defect is specific to
  multi-room demand.
- **What happens.** `proto.js:1866` renders the summary line as
  `S.rooms + ' × ' + (S.rate || 'Cameră dublă vedere mare')` — the **searched** room count — while
  the total comes from `S.ratePrice`, which is never multiplied. The hotel page's own booking bar
  had said "1 camere" for the same selection one step earlier, so the quantity also changes between
  steps.
- **Why it costs conversion.** Verified in source: at the payment step the order summary states
  goods the total does not cover. Whichever way the business resolves it, it loses — honour the
  summary and give away a room, or honour the price and refuse a customer who has already paid an
  advance against a written summary. Either resolution runs through the call centre. This is the
  one finding here that is unambiguously a defect rather than a design question.
- **Why v1 missed it.** v1's price-tracking table did include a multi-room path but stopped it at
  the hotel page; the defect is one step further on. The code is unchanged since `ca5dbf0`.
- **Fix.** Decide what a multi-room booking is in this design — N independent room selections, or
  one selection × N — and render quantity and total from the same source. This is the checkout-side
  expression of CONV-01's missing occupancy model, and the two should be fixed together.
- **Smallest shippable slice:** render the line from the **selected** room count rather than
  `S.rooms`, so quantity and price agree even before the occupancy model exists.
- **Card type:** implement.
- **Definition of Done must include:** P0 conversion must not fall; the quantity in the checkout
  summary and the amount charged are derived from one value, and the hotel booking bar and the
  checkout summary never disagree.
- **Blocked by:** none — but ship with CONV-01.

### CONV-16 — The English checkout tells the customer what they owe, in Romanian

- **Repro:** `checkout-en.html?from=2026-06-05&to=2026-06-12&adults=2&kids=2&rooms=2`, guest.
- **Markets / surface confirmed in:** EN · desktop only (mobile EN is correct — that is the point).
- **What happens.** On the English checkout the summary reads "5 Jun – 12 Jun · 7 **nopți**",
  the product is "2 × **Cameră dublă vedere mare + 2 șezlonguri incluse la plajă**", the board is
  "**Mic dejun inclus**", and the balance instruction is entirely Romanian: "**Restul de 4 182 Lei
  — online până la 22 mai sau la hotel**". Source: `proto.js:1852` (balance), `:1864` (nights),
  `:1867` (board), `:2048` (confirmation payment state) write RO literals with no `EN()` branch —
  while `proto.js:566/567`, twenty lines away, branch correctly. **`proto-m.js:1771` and `:1916`
  wrap the same two strings in `t(RO, EN)`** — the mobile engine already solved this.
- **Why it costs conversion.** Verified in source: the sentence telling an English-speaking customer
  how much remains and by when is not readable to them. The balance is the P1 metric the business
  cares about most after the advance, and the fallback for an unreadable instruction is the phone
  line — which is the cost this redesign exists to reduce.
- **Also found:** `.flexi-toggle` renders "vezi prețurile ▾" on EN pages (`proto.js:1806`, no `EN()`
  branch). Same root cause, smaller surface.
- **Fix.** Wrap the five `proto.js` call sites in the existing `lang()` helper, copying the strings
  already written in `proto-m.js`. Then check whether the room name should be a translated field
  rather than carried in state as Romanian — that is the only part of this that is a design
  question.
- **Exchange rate vs P0:** this is a defect with no trade-off — the fix costs nothing in
  completions. Stated for completeness: the untranslated balance line reaches every EN customer at
  the balance-collection step; its value is the share of EN bookings whose balance is collected
  online rather than by phone or at reception. LITRO's order data holds both sides; neither is
  measurable here.
- **Smallest shippable slice:** the balance line (`proto.js:1852`) alone — it is the only one of the
  five that carries a payment obligation.
- **Card type:** implement.
- **Definition of Done must include:** P0 conversion must not fall; no `proto.js` painter writes a
  user-visible string without a language branch, verified on all `-en` pages.
- **Blocked by:** none.

## Handoff gaps

Not defects: decisions the artifact does not make, which the implementing team will otherwise make
by default and invisibly. Ranked by what they cost to resolve *later*, which is the only cost that
exists yet. **`/impl-guide` reads the Findings table only** — pass this section explicitly if you
want these carded.

| ID | Gap | Why it will not resolve itself | Who decides | Lead time | Severity | v1 status |
|---|---|---|---|---|---|---|
| HAND-01 | **The checkout has never been designed as a form.** Zero real `<input>` elements on either surface; 13 pre-filled `.inp` divs on desktop, 10 on mobile, carrying a happy-path identity. No empty state, no field order or requiredness, no RO address convention (Județ + Oraș, diacritics, +40 prefix), no validation or error states, no `autocomplete` tokens. | Every review of this screen so far has looked at a picture of success. The state every real user starts in has never been seen by anyone, and the implementing team will invent all of it. | design + eng | L | medium | **still open** |
| HAND-02 | **No event contract.** Zero tracking call sites in either engine. Needs the `online` vs `request-only` dimension (without it the corrected KPI tree is unmeasurable) and a `variant` dimension (without it C vs D is unfalsifiable forever). | The redesign's stated purpose is moving volume off a 10:00–18:00 phone line. The phone path is invisible to web analytics by construction, so if it is not designed as measurable now it stays an opinion after launch. | design + eng + business | M | medium | **still open** |
| HAND-03 | **The reference price has nowhere to live.** `proto.js:556` / `proto-m.js:207` compute the struck-through price as `total / (1 − disc)`, so the discount badge generates the "was" price rather than the reverse. | There is no field in which a stored 30-day low could sit, so the first implementation will keep deriving it. Longest lead time on this list, and it silently gates surfaces that do not exist yet (feeds, emails). | business + eng | L | medium | **still open** |
| HAND-04 | **Offer expiry has no campaign end date.** "expiră în 4 zile" / "expires in 4 days" are literals in markup. | A string implements as a string. LITRO's offer programmes genuinely do expire, so the honest version is available — it just has to be ordered. | business | S | low | **still open** |
| HAND-05 | **Which filter facets are real is undecided.** The rail shows facets with counts; only a handful are wired, and the result count (1 236) does not move when the destination changes. | Counts imply an availability-backed facet contract. Either order it or trim the rail to what is real — a short honest rail beats a long decorative one. | eng + business | M | low | **still open** |
| HAND-06 | **The confirmation page states the outstanding balance twice, and disagrees with itself.** Payment block says "Restul de **4 182 Lei**"; the "Ce urmează?" block says "**2 832 Lei**" (frozen at the default `ratePrice` of 4 046). | The balance is authored in two places with no nominated source of truth. This is the page that triggers balance collection — a P1 the business ranks highly. | design + eng | S | low | **still open** |
| HAND-07 | **Nothing decides where a homepage offer card leads.** `.hcard` click wiring exists only inside `initHotel()` (`proto.js:1820`, "nearby hotels"), so no offer card on `home-c` navigates — priced or unpriced, uniformly. | The unwired link is scaffolding; the *undecided destination* is not. Does a campaign card open the hotel with that campaign's rate preselected, or a filtered listing? Nobody has chosen, so the implementer will. | design | S | low | new in v2 |

Severity here is capped at `medium` by design: a gap is not an observed defect, and letting these
compete with findings is how a design review turns into a maturity complaint.

## Wave 1 — the batch to fix before implementation starts

No measurement window exists, so selection is by what gets more expensive after the build, and by
how much implementation work each one would otherwise invalidate.

1. **CONV-07** — bind the benefit strip to the selected rate's policy fields.
2. **CONV-02** — derive both deadlines once; delete every literal.
3. **CONV-13** — render quantity and total from one source.
4. **CONV-16** — add the missing language branches, copying `proto-m.js`.
5. **CONV-01** (smallest slice) — stop naming a party composition that was not priced.
6. **CONV-12** (smallest slice) — render the existing flexible-date strip on the no-availability
   dead end.

**Sequencing constraint.** CONV-01 and CONV-13 share a root — no occupancy dimension — and the full
CONV-01 fix (capacity as a field, a designed "does not fit" state) must be decided **before** anyone
implements the offer model, or it will be retrofitted against a shipped schema. CONV-07 and CONV-02
have no dependencies and are a day of design work between them. HAND-01 should be designed before
the next design review rather than after it: until the checkout form exists as a design, that step
is unauditable and is being specified by default.

**Invariants this batch must not break** — copied from *What this design gets right*: the amount
stays stable from tile to payment; `taxa de stațiune` stays outside the headline price and named; no
paid extra becomes pre-ticked; purchase consent stays separate from marketing and keeps gating the
CTA; no overlay appears on a checkout route; the stay bar keeps repricing in place; request-only
rows stay visually distinguishable from instantly-confirmable ones.

**Not in Wave 1, deliberately:** CONV-15, CONV-14 and CONV-10 are all `INVESTIGATE`. Each is
answerable from data LITRO already owns about its live site, and none should be built on my
judgement.

## Strategic recommendations

1. **Answer the three `INVESTIGATE` rows from production data before the next design round.** All
   three — the value of request-only inventory, priced vs unpriced homepage modules, homepage scroll
   depth — are queries against the live site, not experiments. They are the difference between a
   redesign argued from taste and one argued from evidence, and they cost days.
2. **Decide the occupancy model before the offer schema is written** (CONV-01, CONV-13, HAND-01).
   Unit capacity, room multiplication, child age bands (LITRO's real 0–9.99 / 0–13.99), and the
   "party does not fit" state. Retrofitting occupancy into a shipped pricing schema is the most
   expensive item implied by this report.
3. **Design the asynchronous online path for request-only stock** if item 1 says it is worth it
   (CONV-15). This is the only finding here that changes what the business sells rather than how it
   is described, and it is the direct expression of the KPI-tree correction.
4. **Order the event contract and the price-history field now** (HAND-02, HAND-03). Longest lead
   times, both gate surfaces that do not exist yet, and both are cheap as a specification and
   expensive as a migration.
5. **Stop duplicating defects across surfaces.** Mobile and EN were added between v1 and v2 and both
   inherited CONV-02 and CONV-07 verbatim. Whatever the fix for the shared painters, apply it in the
   shared painter — `proto.js` and `proto-m.js` have already diverged on translation
   (`proto-m.js` correct, `proto.js` not), which is how CONV-16 happened.

## Statistics
- Findings: **0 critical · 5 medium · 4 low**
- Tier: P0 8 · P1 1 · P2 0  |  Class: Blocker 0 · Friction 3 · Leak 6 · Polish 0
- Observation evidence: [OBSERVED] 8 · [CODE] 1 · [CLIENT-CODE] 0 · [DATA] 0 · [PLATFORM] 0 ·
  [RESEARCH] 0 · [HYPOTHESIS] 0
- Mechanism evidence: [DATA] 0 · [PLATFORM] 0 · [RESEARCH] 1 · [CODE] 5 · [HYPOTHESIS] 3 —
  *no row's cost is measured. Five rest on contradictions verified in source, which is the strongest
  evidence a pre-launch artifact can carry; three rest on judgement and are marked `INVESTIGATE`
  rather than argued.*
- Ordering basis: funnel position
- Decisions: SHIP 6 · SHIP+MEASURE 0 · TEST 0 · INVESTIGATE 3
- Walkthroughs completed: 4  |  Complete price paths tracked: 3
- Legal side-notes handed off: 6  |  Handoff gaps: 7

## Suggested CLAUDE.md Updates

### Conversion Baseline
- **P0:** a paid booking completed **online** (30% advance or full). The call centre is **not** a P0
  path — it is a cost line. Confirmed by the product owner 2026-07-29, correcting v1.
- **Micro-conversions:** search performed → results seen → hotel opened → rate selected → checkout
  started → payment attempted → booking confirmed.
- **P1, in order (inferred, unconfirmed):** call-centre contacts per 100 bookings → share paid in
  full up front → cancellation rate → AOV → FRIENDS enrolment → marketing consents.
- **Current step-level conversion:** not measured — no instrumentation exists.
- **Instrumentation maturity:** none. Zero tracking call sites in `proto.js` / `proto-m.js`.
  Screen- and action-level granularity: no.
- **Marketing-automation capability:** none in the prototype.
- **Cost to convert on the primary path:** search → results → hotel → rate → checkout → confirm =
  6 screens, 1 rate decision, 1 consent, 0 typed characters (no real form exists yet).
- **Experimentation capability:** none; no traffic. Realistic MDE: not applicable pre-launch.

### Funnel Invariants to Protect
- The displayed amount is stable from result tile to payment. *(today correct — protect)*
- `Taxa de stațiune` stays outside the headline price and is named as payable at the hotel, on every
  surface. *(today correct — protect)*
- No paid extra is pre-ticked; purchase consent stays separate from marketing consent and keeps
  gating the CTA. *(today correct — protect)*
- No overlay fires on a checkout route. *(today correct — protect)*
- Request-only rates stay visually distinct from instantly-confirmable ones. *(today correct —
  protect)*
- No cancellation or payment-timing promise renders without a selected rate, and every such promise
  agrees with that rate's own policy fields.
- A rate carrying cancellation conditions is never the default-reflected rate.
- Cancellation and balance deadlines are each computed once from the stay and bound everywhere; no
  literal dates.
- No price caption names a party composition the price was not computed for.
- A party exceeding a unit's declared capacity cannot reach checkout silently.
- Checkout quantity and the amount charged derive from one value.
- Every dead-end state offers at least one in-product recovery control before a phone number.
- No `proto.js` / `proto-m.js` painter writes a user-visible string without a language branch.
- At 1440×900, at least two priced offer cards are at least partly visible in the first viewport of
  the homepage and the listing.
- The reference price comes from stored 30-day history; the percentage is computed from the
  reference, never the reference from the percentage.

## Suggested Memory Updates
- The product owner ruled on 2026-07-29 that **the call centre is not a parallel P0 conversion path**
  for LITRO — the phone is a cost to reduce. This inverts how "phone as a scalpel" components are
  scored and supersedes the framing recorded in the v1 report and in the earlier session note.
