# Implementation Verification Report

## Verification moment
- **Date:** 2026-08-06 00:42:31
- **Branch:** main
- **Commit:** c85e402 — Make the page length a switch: 10 / 20 / 30 results (implementation is uncommitted on top)
- **Impl guide:** `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md`
- **Implementation report:** `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-impl-report-20260805-2343.md`
- **Source reports:** `docs/audits/operator-findings-20260805-2235.md`
- **Reviewer:** Claude (impl-verify skill)
- **Toolkit version:** 6.0.1
- **Reasoning tier applied:** verification ran at `high` (opus) — at least as strong as every
  implementing tier (`economy` for IMPL-2/3/5, `standard` for IMPL-7/8/9, `high` for the rest), and
  never `economy`, per `references/runtime-execution.md`.

**Fresh-session caveat, stated rather than waived.** The skill requires a fresh session and this is
the session that orchestrated the implementation. Rather than warn and proceed, per-card
verification was delegated to two agents with no prior context, which is the closer approximation
to the requirement's intent; this document synthesises their findings. The residual bias is mine in
the *synthesis*, not in the checking — and the checkers did contradict the implementation report in
six places, including two defects in the orchestrator's own integration fix (IV-04, IV-11).

## Dashboard

| Metric | Value |
|--------|-------|
| Total cards | 10 |
| ✅ Implemented | 9 (90%) |
| ⚠️ Partial | 1 (10%) |
| ❌ Not implemented | 0 (0%) |
| 🔀 Differently than plan | 0 |
| 🗑️ No longer needed | 0 |
| Total DoD points | 46 |
| DoD points met | 45 (98%) |
| Tests required | prototype: none by design; skill: suite must not weaken |
| Tests existing | skill 139 |
| Tests passing | 139 / 139 |
| Branch coverage (changed files) | N/A — prototype ships no coverage tooling |
| Mutation score (changed files) | N/A |
| New findings (holistic audit) | 14 |

## Completion score: 95%

`(9 × 1.0 + 1 × 0.5) / 10 × 100 = 95%`

---

## Card verification

| Card | Outcome | Evidence |
|------|---------|----------|
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-1` | verified | `linkBase` gone (`typeof layer.linkBase === 'undefined'`); `pageBase()`:911 / `shareBase()`:915 / `shareLink()`:921; all in-page consumers take `pageBase()`. Live counterfactual in the same page: `replaceState` with the share URL still throws `SecurityError`, so the mechanism is real and the split is what avoids it. 11 malformed and 6 hostile `anchor.page` shapes all refused, none threw, every in-page URL stayed on the current origin. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-2` | verified | All 9 `showError()` sites forward a cause; real rejection produced `[proto-comments] cause: permission-denied Error: Missing or insufficient permissions.` Reviewer sentence unchanged verbatim. Normal load: 0 console errors beyond the pre-existing favicon 404. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-3` | verified | Error popover measured at `{top:409.4, left:545, right:895, bottom:490.6}` on 1440×900, with a control confirming the stale off-screen state existed first. Survives `scrollTo(0,4000)` + `resize` + explicit `positionPins()` unchanged. `.pc-close` present and closes it. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-4` | verified | 8 archive/language page pairs tested with a universally-resolving selector — 0 pins leaked in all 8. Anchor page absent from the prototype: 0 pins, not detached. `#c=` restore across pages works. See IV-09/IV-10 for two residual edge cases that do not breach the DoD. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-5` | verified | 6 anchor corners × 2 content heights × 3 viewports (1440×900, 390×844, 1440×320) — 29/29 assertions inside the viewport, no horizontal scroll induced, popover stays flush to its anchor rather than centring. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-6` | verified | Hub links all three; both panel sheets carry `.pt-sheet-page` in both engines, both skins, both languages; the link renders over `file://` where the sheet itself has nothing to show; `grep -c "\.rp-"` = 0 in `litro.css`, `litro-m.css`, `proto.css`. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-7` | verified | 48 `.rp-card` with 48 non-empty `.rp-body`, dates monotonically non-increasing; 220 screen links across 31 distinct hrefs, all curled at HTTP 200; 48 commit links all to the correct repository; `scrollWidth === clientWidth` at 1440 and 390. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-8` | verified | 10 `.uc-item` all with story/rules/state; 22 deep links, 0 with `nopanel`; 12 `.ref-axis` and 29 `.ref-option`, 29/29 with a real `doc`; lazy-loading proven by network (4 of 10 PNGs on load, 10 after scrolling); forced-404 capture path yields 10 fallback notes and 0 broken images. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-9` | partial | DoD bullet 3 — "each thread deep-links to its pin **and opens it on the current origin**" — fails outright: on `http://localhost:8080` all six links resolve to `https://mateuszkoslacz.com/…` (IV-01). The signed-in render path, which the implementer declared unverifiable, was driven through the documented `options.store` seam and works — but only via `subscribe()`; the initial `store.list()` delivery leaves the page on "Loading" forever (IV-02). Filter, count, degraded paths and single-Firebase-init all verified. |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#IMPL-10` | verified | All five fixes present in the template (156-line diff vs the prototype, all comment rewording plus deliberate genericisation); hard grep for `litro\|litoral\|mamaia\|szallas\|romanesc\|#004B97\|#EB802D\|home-c\|listing-c` across the three templates → 0 hits, 0 Romanian diacritics; PHASE 0/7/11/12 and both GOTCHAS rows present; template and `SKILL.md` agree on hub order. Suite 139/139, lint and format clean, **no test weakened** (8 → 10 `test(` blocks, both original assertions kept and re-pointed). |

---

## Holistic audit

### Consistency across cards — ⚠️
IMPL-1 created `shareLink()` for pasteable links and IMPL-9 immediately used it for an in-page link
(IV-01). Two cards in the same round, one undoing the other's point at a new call site. The shell
built by IMPL-6 also carries two defects that IMPL-7 and IMPL-9 inherited rather than caught
(IV-07, IV-14).

### Regressions — ✅
All 26 screens load at both viewports with zero console errors beyond a pre-existing `favicon.ico`
404. `refresh.js --fast` and `build-usecases.js --no-capture` both exit 0 with counts intact
(48 entries, 10 use cases, 12 axes, 29 options). Skill suite 139/139. The `comments.config.json`
404 that existed before this round is gone — the file now returns 200.

### Missed aspects — ⚠️
`OP-04`'s intent (a pin belongs to its own page) is met for every page pair that exists today, but
two paths the finding implies remain open: a basename collision across directories (IV-09) and a
page-less thread belonging to every page, which makes the store's `orphaned` flag flap as the
reviewer navigates (IV-10).

### Implementation cleanliness — ⚠️
No debug code, no commented-out blocks, no stray files in `tools/`. But the changelog page prints
the `Co-Authored-By: Claude Opus 5` trailer 48 times on a stakeholder-facing page, renders the raw
data value `unreleased` as a heading on a Romanian page, and contradicts itself across languages in
its own count line (IV-13).

### Quality metrics — N/A
The prototype ships no coverage or mutation tooling by design. The skill's suite is the only
automated gate and it grew by two tests.

### Security & performance of new code — ⚠️
One real issue: opening the read-only overview page issues a Firestore **write** (IV-03). The rules
permit it, so it is not an authorisation hole, but a page framed as read-only should not write.
No unbounded queries introduced — `THREAD_PAGE_SIZE` and `DETAIL_CONCURRENCY` still bound the reads.

---

## Findings (sorted by severity)

| ID | Type | Severity | Source | Location | Problem | Recommendation |
|----|------|----------|--------|----------|---------|----------------|
| IV-01 | DoD gap | ❌ crit. | IMPL-9 | `comments.html:131-137`, `templates/comments.html:127-136`, `SKILL.md:509-517` | Every "open the pin" link uses `shareLink()`, so on localhost all six resolve to `https://mateuszkoslacz.com/…` — the exact mirror of OP-01, reintroduced by the API IMPL-1 created, and now written into the skill contract | Use `deepLink(thread).href` for the row link; keep `shareLink()` for a separate copy-link affordance. Fix template and the PHASE 11 paragraph together |
| IV-02 | Correctness | ⚠️ med. | IMPL-9 | `proto-comments.js:622`, `comments.html:288-334` | `this.setThreads(await this.store.list())` reads the property **before** the await, so a page that patches `setThreads` after `init()` is bypassed; the overview then hangs on "Loading" with 0 cards. Production wins the race only by Firebase's scheduling | Split the line so the property is read at call time; make the post-`wire` fallback unconditional and call `hydrate` alongside `render` |
| IV-03 | Security | ⚠️ med. | IMPL-9 | `proto-comments.js:705-713` via `comments.html` | The read-only overview mounts the full layer, so a page-less thread reaches the detached branch and writes `orphaned:true` to Firestore | Suppress pin/tray rendering on an overview page rather than hiding it with CSS — an init flag that short-circuits `renderThreads` |
| IV-04 | Regression | ⚠️ med. | orchestrator integration | `templates/index.html:23-26` | The review-pages section added at integration uses `.rp-*` classes but the template head never links `proto-review.css` — a generated hub renders three unstyled div stacks | Add the stylesheet link, with the prototype's explanatory comment |
| IV-05 | Edge case | ⚠️ med. | IMPL-9 | `comments.html:131-137`, `:240-245` | `deepLink()` never throws, so an unresolvable anchor falls back to `pageName()` — on the overview that is `comments.html`, producing a live-looking link to nowhere and making the "link could not be built" fallback dead code | Compare the produced filename against `anchor.page` and return null on mismatch so the existing fallback renders |
| IV-06 | Correctness | ⚠️ med. | IMPL-8 | `proto.js:79` | `['adults','kids','rooms','ratePrice'].forEach(k => …+q.get(k))` turns `rooms=on` into `NaN`; 4 of 22 use-case deep links open a screen reading "2 adulți, 2 copii, NaN camere" | Skip non-numeric values at that line, or rename the panel axis in `usecases.json` so it cannot collide with the search-state key |
| IV-07 | Correctness | ⚠️ med. | IMPL-6 | `proto-review.css:137,173` and `templates/proto-review.css:122,155` | `.rp-nav`/`.rp-toolbar` set `display:flex` at class specificity, beating `[hidden]`. `#cl-jump` renders 36.9 px while hidden; `#cm-toolbar` renders 34.9 px of live filter chips on the signed-out page | One line in both stylesheets: `.rp-nav[hidden], .rp-toolbar[hidden] { display: none; }` |
| IV-08 | Correctness | ⚠️ med. | IMPL-9 | `comments.html:267-286` and the template | `hydrate()` stubs `history.replaceState` and restores in `.finally()`; overlapping batches capture the stub as the original, permanently replacing the native function. Reproduced. `hydrating[id]` is also never cleared on failure | Guard with an in-flight counter (patch on 0→1, restore on 1→0); delete the `hydrating` entry in each `catch` |
| IV-09 | Edge case | ⚠️ low | IMPL-4 | `proto-comments.js:697-700` | `belongsToThisPage` resolves the anchor to a URL then compares only the basename, so `docs/listing-c.html` renders a pin on `/listing-c.html`. Ported to the skill; the skill test only covers the non-colliding direction | Compare the resolved pathname against `pageBase().pathname`; add the colliding case to `anchor-navigation.test.js` |
| IV-10 | Correctness | ⚠️ low | IMPL-4 | `proto-comments.js:694-696` | A thread with no `anchor.page` belongs to every page, so it reaches `elementFor` everywhere and the store's `orphaned` flag flaps between true and false as the reviewer navigates — the very thing page-scoping was meant to prevent | Either treat a missing page as belonging to no page, or keep the behaviour and skip the orphan write when the field is absent |
| IV-11 | Documentation | ⚠️ low | orchestrator integration | `templates/index.html:123` | The added section tells the reader to run `node tools/serve.js`, which is the LITRO prototype's file and is not shipped by the skill; the sibling templates correctly say `npx serve .` | Align with `templates/changelog.html` and `templates/usecases.html` |
| IV-12 | UI | ⚠️ low | IMPL-5 | `proto-comments.js:888,896` | The clamp dropped the layer's 18 px chrome gutter (`Math.max(0,…)` where it was `Math.max(18,…)`), so a corner-anchored popover sits flush with the viewport edge; it also measures `innerWidth`, which includes a classic scrollbar | Restore the 18 px gutter and clamp against `document.documentElement.clientWidth` |
| IV-13 | Copy | ⚠️ low | IMPL-7, IMPL-8 | `changelog.html:199-201`, `usecases.html:203` | `unreleased` rendered untranslated as a heading on a Romanian page while `proto-sheets.js:58` maps it to `Nepublicat`; the count line says "din primele 50" (first) but "of the latest 50" in EN; the `Co-Authored-By` trailer prints in all 48 bodies; two Romanian gender errors in the missing-capture note | Reuse the sheet's round label, fix the count wording, strip the commit trailer for display, fix the two agreements |
| IV-14 | UI | ⚠️ low | IMPL-6 | `proto-review.css:236` vs `comments.html:67` | `.rp-btn` is typed to `a`, but the sign-in control is a `<button>`, so the comments page's only call to action renders as a raw UA button. The skill template already has the fixed selector | Back-port `a.rp-btn, button.rp-btn` from `templates/proto-review.css` |

## Expected effects

| Finding | Observable | Read how | Value at emission |
|---|---|---|---|
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-01` | the pin link's origin on the comments overview | load `localhost:8080/comments.html` signed in, read `document.querySelector('.cm-thread a').href` | `https://mateuszkoslacz.com/…` |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-02` | cards rendered after an initial `store.list()` delivery | inject a store via `protoComments.init({store})` on `comments.html`, count `.cm-thread` | `0`, page stuck on "Se încarcă firele…" |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-03` | Firestore writes issued by opening the overview | drive `comments.html` with a page-less thread and count `updateDoc` calls on the injected store | ≥1 `orphaned:true` write |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-04` | computed style of `.rp-card` in a hub generated from the template | render `templates/index.html`, read `getComputedStyle(document.querySelector('.rp-card')).borderRadius` | unstyled (no `proto-review.css` linked) |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-05` | the fallback sentence for an unresolvable anchor | render a thread with `anchor.page = 'https://evil.example.com/x.html'` and read its link | link to `comments.html#c=…`; fallback text never rendered |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-06` | the guests field on a `rooms=on` deep link | open `home-c.html?rooms=on`, read the search hero text | `2 adulți, 2 copii, NaN camere` |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-07` | rendered height of a `hidden` `.rp-nav` | `document.getElementById('cl-jump').getBoundingClientRect().height` with `hidden` set | `36.9` |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-08` | `history.replaceState` after two overlapping hydrate batches | `String(history.replaceState)` after the second subscribe delivery | `"function () {}"` (stub, not native) |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-09` | pins drawn for a subdirectory anchor | render a thread with `anchor.page='docs/listing-c.html'` on `/listing-c.html`, count `.proto-comment-pin` | `1` (should be `0`) |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-10` | `orphaned` writes as a page-less thread's reviewer navigates | count `updateDoc` calls across two page loads with a page-less thread | flaps `true` → `false` |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-11` | the serve command named in the hub template | `grep "serve" templates/index.html` | `node tools/serve.js` (not shipped by the skill) |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-12` | popover inset at a corner anchor | anchor bottom-left on 1440×900, read `getBoundingClientRect().left` | `0` (was an 18 px gutter) |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-13` | the round heading text on the changelog page | `document.querySelector('#cl-root h2').textContent` | `unreleased` |
| `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md#IV-14` | computed background of the sign-in control | `getComputedStyle(document.querySelector('.rp-btn')).backgroundColor` on `comments.html` | `rgb(239,239,239)` (UA default) |

## Recommendation

⚠️ **Requires fixes** — 14 findings, one of them a card DoD failing outright (IV-01) and now baked
into the skill contract. The comment layer's five original defects are genuinely fixed and
independently reproduced; what remains is a second layer of defects created by the round itself,
concentrated in `comments.html` and in the shared shell. Run
`/impl-guide docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md`
to generate the next iteration's cards.

## Suggested CLAUDE.md Updates

### New Patterns to Document
- **Two link kinds in the comment layer.** `pageBase()`/`deepLink()` for anything in-page —
  navigation, history, an `<a href>` a reviewer clicks; `shareBase()`/`shareLink()` only for a link
  meant to be pasted elsewhere. IV-01 is what happens when the distinction is not written down.
- **Pins are page-scoped.** A thread renders only on its `anchor.page`; the comments overview is the
  only surface showing all threads at once.

### Known Issues Updates
- ADD: IV-01 (critical) — comments overview links leave the reviewer's origin; also in the skill template.
- ADD: IV-06 (medium) — `?rooms=on` collides with the search-state `rooms` key and yields `NaN camere`.
  This is a second instance of the collision CLAUDE.md invariant #10 already covers on the panel side.

## Next step

`/impl-guide docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md`

## Handoff
- Source: `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md`, `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-impl-report-20260805-2343.md`
- Scope: `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md#{IMPL-1,IMPL-2,IMPL-3,IMPL-4,IMPL-5,IMPL-6,IMPL-7,IMPL-8,IMPL-9,IMPL-10}`, IV-01, IV-02, IV-03, IV-04, IV-05, IV-06, IV-07, IV-08, IV-09, IV-10, IV-11, IV-12, IV-13, IV-14
- State: `partial`
- Evidence: `uncommitted` — skill suite 139/139; 26 screens clean; independent headless-Chrome verification of every card
- Next: `/impl-guide docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242-verify-report-20260806-0042.md`
