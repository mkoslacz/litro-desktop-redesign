# CLAUDE.md — litro-desktop-redesign

Clickable design prototype for **litoralulromanesc.ro** (LITRO), built on the approved Szallas Group
design system with a LITRO brand skin. Static HTML — no backend, no payment integration, no tracking
layer. See [README.md](README.md) for structure, the brand mapping and the `.fig` pipeline.

Local preview: `node tools/serve.js` (port 8080, `Cache-Control: no-store` on every response — this
is what stops the preview pane testing a stale `proto.js`/`proto.css`). **`no-store` also disables
Chrome's bfcache**, so any back-navigation bug that depends on a restored page is invisible on this
server and shows up only on GH Pages — to reproduce one, serve the folder with cacheable headers.
The port is overridable — `PORT=8090 node tools/serve.js` — and on this machine 8080 is sometimes
held by an unrelated dev server that answers **200 to every path** with an SPA fallback. A
measurement taken against it looks plausible and is worthless, so confirm the server you reached is
this one before believing a number.

## The comment layer — rules a later card must read before touching it

Round 2 of the operator-findings loop existed almost entirely because the rules below lived in code
comments and nowhere a planner would look. Three of its fourteen findings were defects *created by
the round that fixed the previous fourteen*. Write the rule here, not only beside the function.

- **Two link kinds, and they must not share a base.** `pageBase()` / `deepLink()` resolve against
  the origin the reviewer is actually on and are the ONLY correct builders for anything clicked
  in-page. `shareBase()` / `shareLink()` resolve against `config.prototypeUrl` and exist solely for
  a link meant to be pasted somewhere else — a copy-link affordance. Used at an in-page call site,
  `shareLink` walks the reviewer off their own copy onto the published site, and a `replaceState`
  built from it throws `SecurityError`. This has now been the root cause twice (`OP-01`, then
  `IV-01` at a call site the `OP-01` fix created).
- **A page that owns no anchors passes `overview: true`.** It suppresses pins, the tray and the
  orphan write at the source. Hiding that chrome with CSS is not suppressing it: `renderThreads()`
  still runs and still writes `orphaned` to Firestore from a page that calls itself read-only.
- **Page identity is the whole normalised path, never the basename.** `docs/listing-c.html` and
  `/listing-c.html` are different pages. `belongsToThisPage()`, `needsRestore()` and
  `safePagePath()` must agree — when the navigate decision and the render decision disagree, a pin
  renders where its deep link will not go.
- **A thread with no `anchor.page` renders but is never written about.** The permissive render is
  load-bearing for threads stored before the field existed; the layer simply cannot establish
  orphanhood for a thread it cannot locate to a page, so it must not claim to.
- **`protoComments.init({store})` is NOT a seam for counting store writes.** `privateOrphanUpdate`
  resolves the store through a `STORE_PRIVATE` WeakMap that only `createFirebaseClient` populates,
  so an injected plain store makes every orphan write a silent no-op and any `updateDoc` count a
  vacuous zero. A DoD that says "counted on an injected store" must inject `createFirebaseClient`
  plus `loadModule` instead.
- **Reading live threads requires an allowlisted Google sign-in** (`comments.rules`, named
  allowlist, no domain rule, no open mode). Any verification without those credentials is a
  behavioural check through the injected seam, and must say so rather than claim the live path.
- **This prototype and the `design-prototype` template currently disagree in two places, and the
  prototype is the one that is right.** Decided by the operator on 2026-08-06; the template moves
  when someone next touches it. A thread with no `anchor.page` keeps the permissive render and skips
  only the orphan write (the template returns "belongs to no page"); and the template's contract
  test bans `shareLink(` outright, which now forbids the copy-link affordance that is that
  function's one legitimate use — the ban narrows to the row's `href`. Do not "fix" the prototype
  towards the template. Both are open findings — `IV-16` and `IV-17` in
  `docs/impl-guides/…-verify-report-20260806-1016.md`.

## Known Issues

No `critical` findings open. The current audit is
[docs/audits/conversion-review-report-v3.md](docs/audits/conversion-review-report-v3.md) —
7 `medium` and 4 `low`, all with code anchors, plus a per-switch evaluation of the demo panel.
Delta vs v2: zero of the nine open cases were touched across rounds 13-16 (second consecutive
delta with that sentence); two new mediums are v2 misses on unchanged code — CONV-17 (the C
listing opens with five pre-checked filter chips that filter nothing and poison the dead-end
branch diagnosis) and CONV-18 (home-d's headline promises instant confirmation for all 1 236
offers over a rate model with request-only rows); CONV-12 improved in part; HAND-07 is resolved
in implementation. Read the report before changing the funnel.

## Conversion Baseline

- **P0 — a paid booking completed ONLINE** (30% advance or payment in full) on own charter
  inventory. **The call centre is not a P0 path**; the phone is a cost line. Ruled by the product
  owner 2026-07-29, correcting the v1 report, which had treated phone bookings as a parallel
  conversion. Every hand-off to `0241 999` is scored as a leak unless no online path could exist.
- **Micro-conversions:** search performed → results seen → hotel opened → rate selected → checkout
  started → payment attempted → booking confirmed.
- **P1, in order** (inferred, not confirmed by the owner): call-centre contacts per 100 bookings →
  share paid in full up front → cancellation rate → AOV → FRIENDS enrolment → marketing consents.
- **Step-level conversion:** not measured. No traffic, no analytics.
- **Instrumentation maturity: none.** Zero tracking call sites in `proto.js` / `proto-m.js`. When
  the event contract is written it must carry two dimensions that no default schema has:
  **`online` vs `request-only`** on every rate event (without it the P0 above is unmeasurable) and
  **`variant` (C / D)** on every event (without it the C-vs-D question is unfalsifiable forever).
  It must also reserve the demo-panel dimensions — `card_density`, `page_size`, `pinned_mode`,
  `sticky_*` — because the panel's switches are the first post-launch experiments (v3, HAND-08).
- **Cost to convert on the primary path:** 6 screens, 1 rate decision, 1 consent, 0 typed characters
  (no real form exists yet — see below).
- **Experimentation capability:** none, pre-launch. No MDE is meaningful yet.

## Funnel Invariants to Protect

Regression checks. The first five are **already correct** — breaking one is a regression, not a
change. The rest are rules the current code violates; a fix must satisfy them on **all four
surfaces** (desktop/mobile × RO/EN), because that is exactly where v2's findings multiplied.

**Correct today — do not break:**

1. The displayed amount is stable from result tile to payment. Verified on 3 complete price paths.
2. `Taxa de stațiune` stays outside the headline price and is named as payable at the hotel, on
   every surface.
3. No paid extra is pre-ticked; purchase consent stays separate from marketing consent, marketing
   stays labelled optional with a withdrawal right, and the CTA stays gated (`btn-disabled`) until
   the purchase consent is ticked.
4. No overlay fires on a checkout route.
5. Request-only rates stay visually distinct from instantly-confirmable ones. (Their *existence* is
   a finding — CONV-15 — but hiding the distinction is not the fix.)
6. The hotel page's session rule: no search surface for visitors from our own listing; the search
   card and the docked bar exist only for cold entries (`session=new`). Desktop and mobile.
7. The docked sticky search bar is the header compressed — same popovers, same submit handler,
   phone + account + menu carried — never a second navigation; absent in `data-export` mode.
8. The sticky filter column's offset couples to the docked bar via `:has(.ssearch.on)` (74px) — a
   change to either must re-verify the other.
9. The pager's range line always matches the number of cards actually in the list
   (`fillListingPage` keeps 30 real cards behind "Afișăm 1–30").
10. Every demo-panel state stays URL-addressable (`?density= ?per= ?stf= ?sthome/stlist/sthotel=
    ?pin= ?session= ?auth= ?assets= ?inv=`) — it is the workshop review surface and the future
    experiment-flag register.
    **A parameter in this register can also be a search-state key, and then both readers must
    keep working.** `?rooms=` is the worked example: the panel reads `on`/`off`, the search state
    reads a number, and the numeric reader coerced unconditionally — so `?rooms=on` rendered
    "NaN camere" on four of the twenty-two use-case deep links, i.e. on the page built to
    demonstrate the prototype's states (`IV-06`). **Never rename the axis to break the tie** — the
    key is in this register, `usecases.json` documents it and live deep links carry it, so a rename
    trades a rendering bug for a broken-link bug across the whole review surface. Narrow the
    reader instead: a query value enters numeric search state only when it parses as a **finite**
    number, and a legitimate `0` still counts.

**Violated today — a fix must satisfy these:**

6. No cancellation or payment-timing promise renders without a selected rate, and every such promise
   agrees with that rate's own policy fields. A rate carrying cancellation conditions is never the
   default-reflected rate. *(CONV-07)*
7. Cancellation and balance deadlines are each computed once from the stay and bound everywhere.
   **No literal dates.** Changing the stay dates must move every rendered deadline on every surface,
   and all surfaces must show one value. *(CONV-02 — today `hotel.html` says "20 mai",
   `m-checkout.html` says "26 mai", the balance is a hardcoded "22 mai", and nothing derives from
   `S.from`.)*
8. No price caption names a party composition the price was not computed for, and a party exceeding
   a unit's declared capacity cannot reach checkout silently. Capacity is already written down as
   prose in `.rmeta` (`m-hotel.html:147,229`) — promote it to a field and read it. *(CONV-01)*
9. Checkout quantity and the amount charged derive from one value. *(CONV-13 — `proto.js:1866`
   renders `S.rooms × room name` while the total covers one room.)*
10. Every dead-end state offers at least one in-product recovery control before it offers a phone
    number, and names the blocking facet rather than only offering clear-all. *(CONV-12)*
11. No painter in `proto.js` / `proto-m.js` writes a user-visible string without a language branch.
    `proto-m.js` already wraps the money-path strings in `t(RO, EN)`; `proto.js` does not
    (`:1852`, `:1864`, `:1867`, `:2048`, `:1806`). *(CONV-16)*
12. At 1440×900, at least two priced offer cards are at least partly visible in the first viewport of
    the homepage and the listing. When measuring this, **the search hero is the CTA, not chrome** —
    on a step whose next micro-conversion is *search*, counting it as overhead manufactures a leak
    that is not there. v1 published a fold number that made exactly this mistake. *(CONV-10)*
13. The reference price comes from stored 30-day history; the percentage is computed from the
    reference, never the reference from the percentage. *(Today `proto.js:570` / `proto-m.js:214`
    compute `total / (1 − disc)`, so no stored low can exist — handoff gap HAND-03.)*
14. Every rendered filter chip corresponds to a facet that changes the visible result set, and the
    dead-end branch test reads only real facets. *(CONV-17 — today `listing-c.html:146,195,219-222`
    ship pre-checked rows with no `data-f`, and `showEmptyState` reads them.)*
15. No surface promises instant confirmation for a set that includes request-only inventory — the
    claim's scope always matches the model's. *(CONV-18 — today `home-d*.html:262` attach it to all
    "1 236 de oferte".)*

## Undecided by design — the implementing team will decide these by default

Seven handoff gaps are listed in the audit; two are worth knowing before touching the code:

- **The checkout has never been designed as a form.** Zero real `<input>` elements on either
  surface; 13 pre-filled `.inp` divs on desktop, 10 on mobile. No empty state, no field order or
  requiredness, no RO address convention, no validation, no `autocomplete` tokens. Every review so
  far has looked at a picture of success. Do not treat the filled state as the design.
- **Where a homepage offer card leads is now decided** (HAND-07, closed 2026-07-30): a `.hcard` opens
  that hotel's page, exactly like a `.lcard`. The wiring moved out of `initHotel()` — where it was
  dead code, since `hotel.html` carries no `.hcard` at all — into `initGeneric()`, so it holds on
  every surface that renders the component. What stays undecided is the *rate*: a campaign card does
  not preselect the campaign's rate on the hotel page.
- **Page-scoped `init*()` functions are where interactions go to die.** Both bugs reported on
  2026-07-30 were this shape: an interaction wired inside a function that returns early on
  `data-page`. If a component renders on more than one page kind (`.hcard`, `.heart`,
  `.resort-index a`), wire it in `initGeneric()`.

## Review lineage

This repo carries a review-lineage V4 graph at `.review-lineage/` (excluded from snapshots). The v2
audit is admitted: artifact `artifact-conversion-review-report-v2`, event
`evt_098102bf3c67b1f148be6318`, 9 open cases. `/impl-guide` needs the detached receipt in
`.review-lineage/receipts/`, never the report path alone. `docs/audits/` is excluded from the
canonical snapshot as generated output.
