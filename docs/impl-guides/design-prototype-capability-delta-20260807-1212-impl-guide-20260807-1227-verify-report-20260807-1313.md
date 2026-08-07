# Implementation Verification Report — design-prototype capability delta

## Verification moment

- **Date:** 2026-08-07 13:13:56 CEST
- **Branch:** `main`
- **Commit:** `3affc92cce26440582136bc5a82cf4c1cafd0afe` — `test: cover review capability upgrade [IMPL-04]`
- **Impl guide:** `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md`
- **Implementation report:** `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227-implementation-report-20260807-1305.md`
- **Source reports:** `docs/audits/design-prototype-capability-delta-20260807-1212.md`
- **Reviewer:** Codex (fresh `impl-verify` session)
- **Toolkit version:** 7.1.1
- **Reasoning tier applied:** `gpt-5.6-sol` / `xhigh`; implementing tiers read from the implementation report: Workstreams B/C `gpt-5.6-sol` / `high`, Workstreams A/D `gpt-5.6-sol` / `xhigh`
- **Runtime/workspace:** Codex collaboration child agent, `fork_turns=none`; read-only verification in the shared repository; no sub-agent launched by this verification
- **Expected base check:** exact match — expected `3affc92`, observed `3affc92cce26440582136bc5a82cf4c1cafd0afe`

## Dashboard

| Metric | Value |
|---|---:|
| Total cards | 4 |
| ✅ Implemented | 4 (100%) |
| ⚠️ Partial | 0 (0%) |
| ❌ Not implemented | 0 (0%) |
| 🔀 Differently than plan | 0 |
| 🗑️ No longer needed | 0 |
| Total DoD points | 22 |
| DoD points met | 22 (100%) |
| Test scenarios required | 9 |
| Test scenarios existing | 9 (100%) |
| Tests passing | committed full capability run: 9 / 9; fresh run: static contracts passed, dynamic part environment-blocked before browser launch |
| Branch coverage (changed files) | N/A — quality tooling not configured |
| Mutation score (changed files) | N/A — quality tooling not configured |
| New target-scope findings | 0 |

## Completion score: 100%

Calculation: `(4 × 1.0 + 0 × 0.5) / 4 × 100 = 100%`.

## Card verification

| Card | Outcome | Evidence |
|---|---|---|
| `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md#IMPL-01` | verified | `3affc92`; stable `cl-`/`uc-` targets, one five-method `CommentLayer` facade, and a non-empty 50 + 10 target inventory; committed capability run covers start/reply/resolve/shared overview |
| `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md#IMPL-02` | verified | `3affc92`; `proto-sheets.js` contains exactly three full-page link definitions, one carried-query builder, and no fetch/sheet renderer; committed browser run covers both panel engines |
| `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md#IMPL-03` | verified | `3affc92`; reviewer files are English, product screens are absent from the implementation diff, and `comments.html` still uses `init({ overview: true })` |
| `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md#IMPL-04` | verified | `3affc92`; focused command and assertions cover all target subjects and explicitly print the seam/live boundary; committed full run passed, while the fresh sandbox rerun reached static PASS then failed only on loopback bind |

## Independent checks

| Check | Result | Evidence |
|---|---|---|
| Base and cleanliness | PASS | `git rev-parse HEAD` returned `3affc92cce26440582136bc5a82cf4c1cafd0afe`; initial and post-check `git status --short` were empty |
| Changed-path boundary | PASS | `git diff --name-status aaa7f17..HEAD` contains only the declared review sources, the focused test and the implementation report; no Firebase rule/config, version, changelog, mobile toolbar, `claude-skills`, or product-screen file changed |
| Focused capability command | ENVIRONMENT-BLOCKED after static PASS | `node tools/test-review-capabilities.js` printed `PASS static contracts: one comment facade, no panel sheets/fetch, English reviewer chrome`, then failed with `listen EPERM: operation not permitted 127.0.0.1`; no `0.0.0.0` retry was attempted |
| Static syntax | PASS | `node --check proto-sheets.js`; `node --check proto-comments.js`; `node --check proto-discussion.js`; `node --check tools/test-review-capabilities.js` |
| Generated use cases | PASS | `node tools/build-usecases.js --no-capture` wrote 10 use cases and 0 captures; its timestamp-only change to `usecases.built.json` was restored byte-for-byte to the clean `HEAD` version |
| Non-empty target sets | PASS | independent JSON inventory: 50 `cl-<sha>` targets and 10 `uc-<id>` targets, all unique |
| Diff hygiene | PASS | `git diff --check aaa7f17..HEAD` |
| Reviewer-language sweep | PASS | no named Romanian reviewer-chrome token in `index.html`, `changelog.html`, `usecases.html`, `comments.html`, `proto-sheets.js`, `proto-discussion.js`, or `proto-comments.js` |
| Local interactive browser walk | ENVIRONMENT-BLOCKED | the in-app browser refused the local `file://` URL by browser security policy; no alternate browser surface or indirect bypass was attempted |
| Live Firebase | NOT TESTED BY DESIGN | no credential, Admin CLI, rules write, Google sign-in, Firestore read, or Firestore write was used |

## Per-card verification

### IMPL-01 — Mount stable inline discussions under changelog and use-case entries ✅

**Status:** Implemented through one presentation module over the existing comment layer.

**DoD checklist:**

- [x] Stable data-derived anchors — `changelog.html:147` uses `cl-<entry.sha>` and `usecases.html:148` uses `uc-<usecase.id>`; the independent inventory is non-empty and unique (50 + 10).
- [x] Read/start/reply/resolve stay on the existing layer — `proto-discussion.js:4-5,95-99,117,130,171,208` consumes only the declared facade; `proto-comments.js:767-812` implements that facade on the existing `CommentLayer` and store.
- [x] The same thread remains available to the overview — both document pages call `protoComments.init({ overview: true })`; `comments.html:453-459` initializes the same client contract, and the committed focused run observes both created IDs and bodies there.
- [x] `file://` and missing configuration are non-destructive — `changelog.html:247`, `usecases.html:264`, and `proto-comments.js:1207-1227` return before comment initialization; the committed check reports visible notices and zero UI side effects.
- [x] Document chrome is English while loaded content is preserved — chrome literals are English and authored JSON fields are inserted as data via `textContent`.
- [x] Focused behavioural coverage exists — `tools/test-review-capabilities.js:191-244,382-414,416-442` covers non-empty targets, start/reply/resolve, shared overview, signed-out and `file://` paths.

**Edge cases:** invalid/empty data returns `false` before mounting (`changelog.html:183-192`, `usecases.html:229-255`); entries without SHA/ID receive no positional target; signed-out users see the English comments-page affordance.

**Architecture:** Correct layer. `proto-discussion.js` contains no Firebase/store/auth/config implementation and delegates all writes to the shared facade.

### IMPL-02 — Replace review preview sheets with carried-query page links ✅

**Status:** Implemented as navigation-only panel content on both desktop and mobile engines.

**DoD checklist:**

- [x] Exactly three English links — `proto-sheets.js:19-23,74-95` declares and renders Changelog, Use cases, Comments.
- [x] Full pages and demo query state — `withCarryQS()` at `proto-sheets.js:45-68` preserves target query values and fragments, then appends unoccupied current-state parameters.
- [x] No preview sheet or fetched review body — the module has no `fetch()` and no `.pt-sheet` renderer; the fresh static contract passed.
- [x] Link construction does not depend on fetch and uses local page paths, so it remains meaningful under `file://`.
- [x] `?nopanel=1` still exits before either panel mounts (`proto.js:803-808`, `proto-m.js:517-524`); these engines and every other demo URL reader were unchanged.
- [x] Focused behavioural coverage exists for desktop and mobile, exact link count/path/query, duplicate-sheet absence, no review-data request, fragment retention, and target-query precedence (`tools/test-review-capabilities.js:247-303`).

**Architecture:** Correct layer. The shared renderer is used by the existing desktop and mobile mount points and uses the reviewer’s current origin, not `prototypeUrl` or the share-link base.

### IMPL-03 — Make the remaining reviewer-facing surfaces English ✅

**Status:** Implemented centrally for the reviewer surfaces without changing product copy.

**DoD checklist:**

- [x] Hub, comments overview and comment sign-in/error strings are English — direct source inspection and the fresh static language contract both pass.
- [x] Product RO/EN screens and URL controls are unchanged — no product-screen file, `proto.js`, or `proto-m.js` occurs in `aaa7f17..HEAD`; the focused static contract still detects Romanian `home-c.html` and English `home-c-en.html`.
- [x] `comments.html` still uses one overview client with `overview: true` and preserves filters, cards, deep links and copy-link separation (`comments.html:142-163,165-304,445-459`).
- [x] No Firebase policy/configuration, mobile toolbar, version or changelog change exists in the implementation diff.
- [x] Focused language and behaviour checks exist and the static portion passed freshly.

**Architecture:** English reviewer chrome is centralized in reviewer modules. Reviewer-authored thread content is rendered unchanged.

### IMPL-04 — Verify the capability upgrade without live Firebase credentials ✅

**Status:** The focused command is complete and passed at the verified commit in the implementation report; this fresh environment independently reached its static PASS and then blocked loopback binding.

**DoD checklist:**

- [x] One repeatable command exists — `node tools/test-review-capabilities.js`; its full successful output is recorded against `3affc92` in the implementation report.
- [x] The command distinguishes the injected seam from live Firebase — it prints `BOUNDARY injected createFirebaseClient only; live Firebase was neither contacted nor verified.`
- [x] Non-empty sets are asserted before universal checks — discussion targets are counted at `tools/test-review-capabilities.js:191-205`; review links are required to equal 3 at `:247-268`.
- [x] `node tools/build-usecases.js --no-capture` passed freshly with 10 use cases and 0 captures.
- [x] No live credential, Firebase rule, scope, version or product-screen change was required.

**Test boundary:** the injected `createFirebaseClient` seam proves client behaviour and one shared contract; it is not evidence of an allowlisted Google sign-in, Firestore authorization, live synchronization or deployed state.

## Holistic audit

### Consistency across cards — ✅

The four cards compose without a second client or duplicate document surface: panel rows navigate; document pages render stable targets; `protoDiscussion` delegates to `CommentLayer`; the comments page reads the same thread contract.

### Regressions — ✅ with environment boundary

Changed-file syntax, generated-use-case validation, diff hygiene and target inventories pass. Product screens and protected Firebase/mobile/version paths are unchanged. The full browser command could not be re-executed in this sandbox because binding `127.0.0.1` is prohibited, not because the application or assertions failed.

### Missed aspects — ✅

All three source findings (`OP-01`, `OP-02`, `OP-03`) are represented by guide cards and independently traced to code and test evidence. No target-subject omission was found.

### Implementation cleanliness — ⚠️ informational risk, no target finding

Runtime behaviour is clean, but pre-existing call-site comments in `proto.js:937-940`, `proto-m.js:642-645`, and `changelog.html:112-113` still describe panel “sheets” and lazy review-data fetching. Those comments are now inaccurate after `IMPL-02`. They do not alter a DoD or runtime contract and the hard scope excluded editing the product engines, so no `IV-nn` is emitted; treat this as documentation debt if those files are next touched.

The implementation report uses `## Delivery summary` / `complete` and a prose `## Boundary and handoff`, not the lifecycle skill’s canonical `## Card results` / `implemented` table and exact five-field `## Handoff`. This is outside the three target subjects and was not repaired or promoted to an `IV-nn`; it requires a separate workflow gate if lifecycle conformance of that already committed report is to be audited.

### Quality metrics — N/A

No coverage or mutation script exists. `npm test` is the repository’s pre-existing placeholder and provides no test signal; the focused capability command is the relevant executable surface.

### Security & performance — ✅ within target scope

The new discussion renderer uses `textContent` for authored content, requires the existing layer’s authenticated user before writes, adds no endpoint or credential, and keeps Firebase authorization in the unchanged existing policy. The 750 ms refresh only inspects the finite rendered target set; no new unbounded I/O loop was introduced.

## Evidence boundary and residual risks

- **Fresh dynamic execution risk:** the browser portion was not rerun here because the sandbox rejected `127.0.0.1` with `EPERM`; the same commit’s full green output is recorded in the implementation report and the test source was independently audited.
- **Live-service risk:** the seam does not prove Firebase configuration, allowlist authorization, Google sign-in, live Firestore writes, cross-session propagation, deployment or production URL state.
- **Documentation drift risk:** three stale “sheet/fetch” comments remain outside the declared changed-file scope, as recorded above.
- **Lifecycle-artifact gate:** the committed implementation report is non-canonical under the current lossless lifecycle format; resolving that artifact-format question would expand beyond `OP-01`–`OP-03`.

No new target-scope `IV-nn` finding was emitted.

## Recommendation

✅ **Implementation complete for the scoped capability delta.** `OP-01`, `OP-02`, and `OP-03` are verified at `3affc92`; the seam/live and sandbox boundaries remain explicit and do not represent a defect in the scoped implementation.

## Next step

None for `OP-01`–`OP-03`. A live Firebase check would be a separate, credentialed operational verification, not another implementation card for this guide.

## Lossless-check status

`python3 /Users/mkoslacz/Workspaces/claude/claude-skills/impl-verify/references/finding_guard.py check --root . --base HEAD` reported that the base comparison could reach only 2 of 21 lifecycle artifacts. The repository ignores `docs/` by default, and this new report is therefore currently untracked and invisible to Git-based immutability/Handoff guards. Per the operator's no-commit boundary, this verifier did not force-add or commit it. The integrator must force-stage the intended lifecycle artifacts and rerun the guard before treating the handoff as covered by the no-loss guarantee.

## Handoff

- Source: `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md`, `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227-implementation-report-20260807-1305.md`, `docs/audits/design-prototype-capability-delta-20260807-1212.md`
- Scope: `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md#{IMPL-01,IMPL-02,IMPL-03,IMPL-04}`
- State: `verified`
- Evidence: `3affc92cce26440582136bc5a82cf4c1cafd0afe; node tools/test-review-capabilities.js => static PASS then sandbox EPERM on 127.0.0.1; committed full-pass output in the exact implementation report; node tools/build-usecases.js --no-capture => 10 use cases, 0 captures`
- Next: `none`
