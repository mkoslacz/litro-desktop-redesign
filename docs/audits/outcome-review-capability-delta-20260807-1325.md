# Outcome Review — design-prototype capability delta

## Review moment
- **Date:** 2026-08-07 13:25:43 +0200
- **Branch:** `main`
- **Commit:** `d5bf30b04edeb909c60a0f0755251d4b4ec893b5` — `docs: record verification guard boundary`
- **Verified code commit:** `2afc1383607331ccd77b34fb235bdf5e69fa8dfd`; `2afc138..d5bf30b` changes only the closing report
- **Source report:** `docs/audits/design-prototype-capability-delta-20260807-1212.md`
- **Closing report:** `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227-verify-report-20260807-1313.md`
- **Guide:** `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md`
- **Findings:** 3 in source — 3 measured, 0 excluded
- **Reviewer:** Codex (fresh outcome-review session)
- **Toolkit version:** 7.1.1

## Measurements

| Finding | Class | Observable | Value at emission | Value now | Read how |
|---|---|---|---|---|---|
| `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-01` | `not read` | a thread started below a changelog or use-case entry is visible below the same entry and in `comments.html`; all operations use `protoComments` | no module, no `data-c`, no inline discussion | **not read** — the required published-URL create → reply → resolve → overview sequence was not performed because this session has no allowlisted Google reviewer sign-in; the local page exposed 50 `cl-*` targets and 10 `uc-*` targets with 60 matching signed-out discussion sections, but that is not a live Firebase reading | prescribed live observation on the published URL; local supporting reads: Codex in-app Browser at `http://127.0.0.1:8097/`, `node tools/test-review-capabilities.js`, and `curl -I --max-time 15 https://mateuszkoslacz.com/litro-desktop-redesign/` |
| `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-02` | `achieved` | panel opens the full changelog, use-case or comments page, carries demo parameters, and renders no page copy in a sheet | panel builds three preview sheets through `proto-sheets.js` | desktop and mobile each render exactly 3 links (`Changelog`, `Use cases`, `Comments`); `auth=in`, `density=c`, `inv=few`, both `tag` values and normal screen state survive; clicking each desktop row opens its full page; preview-sheet DOM count is 0 | Codex in-app Browser against `http://127.0.0.1:8097/home-c.html?auth=in&density=c&inv=few&tag=a&tag=b#screen` and the equivalent `m-home.html` URL; click all three desktop rows and inspect URLs and DOM; execute current `proto-sheets.js` in an isolated DOM model to verify target-query and fragment precedence |
| `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-03` | `achieved` | reviewer surfaces are English while Romanian and English product screens retain their own language | predominantly Romanian reviewer chrome | hub and all three review pages declare `lang=en`; the panel labels are `Changelog`, `Use cases`, `Comments`; changelog and use cases expose English signed-out affordances; comments exposes `Sign in with Google`, `All`, `Open`, `Resolved`; static contract preserves `home-c.html` as `ro`/`Caută` and `home-c-en.html` as `en`/`Search` | Codex in-app Browser walkthrough of hub, panel and all three review pages on `127.0.0.1:8097`; `node tools/test-review-capabilities.js` static contract; focused current-source language assertion |

## Evidence boundary

- `finding_guard.py open --root .` returned 14 / 40 open findings and did not list `OP-01`, `OP-02`, or `OP-03`; all three are in the measurable closed set. The closing report maps them to `IMPL-01`–`IMPL-04`, all `verified`.
- The closing report records a full local 9 / 9 capability run at `3affc92` through injected `createFirebaseClient`. That is conformance evidence and is not reused as a current outcome reading. It proves client-layer behaviour with the injected seam, not Firebase authorization, live synchronization, deployment, or an allowlisted Google session.
- The fresh command `node tools/test-review-capabilities.js` printed `PASS static contracts: one comment facade, no panel sheets/fetch, English reviewer chrome`, then stopped at `listen EPERM: operation not permitted 127.0.0.1`. A separate fresh Chromium launch was also denied by the sandbox. These are environment limits on that dynamic rerun, not evidence that the live effect passed or failed.
- A server already bound outside that sandbox was independently inspected through the Codex in-app Browser at `127.0.0.1:8097`. This produced the current DOM readings for `OP-02` and `OP-03`, and only the signed-out structural reading for `OP-01`.
- The public URL answered HTTP 200, with `Last-Modified: Thu, 06 Aug 2026 14:41:26 GMT`; that header does not identify a deployed Git SHA and does not substitute for the required signed-in Firebase operation.
- A subsequent read-only source check retrieved the public `proto-sheets.js` and found the pre-upgrade `pt-sheets` / lazy `fetch` implementation. The published URL is therefore older than `IMPL-02` and cannot be used to measure `OP-01` against the verified code. This strengthens `EFF-01`'s deployment boundary; it does not create a new code finding.
- No Firebase sign-in, Firestore read/write, Admin CLI, Firebase rule/configuration change, deployment, or credential access occurred.

## Excluded from measurement

None. All three source findings were closed by `verified` cards and measured in this round.

## Findings

| ID | Class | Severity | Closed finding | Card | Problem | Recommendation |
|---|---|---|---|---|---|---|
| EFF-01 | `not read` | ⚠️ med. | `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-01` | `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md#{IMPL-01,IMPL-04}` | The implementation conformed locally, and the current local artifact renders 60 inline discussion targets, but the source finding's required live observable remains unread: no allowlisted reviewer created, replied to, resolved, and re-read the same thread through the published Firebase-backed overview. | After the verified code is available at the published URL, an operator with an existing allowlisted Google reviewer account must perform one recorded create → reply → resolve → overview sequence, capturing the published URL, deployed SHA, timestamp, target `data-c`, thread ID, body, and final status. Do not change Firebase configuration or rules to obtain the reading. |

## Expected effects

| Finding | Observable | Read how | Value at emission |
|---|---|---|---|
| `docs/audits/outcome-review-capability-delta-20260807-1325.md#EFF-01` | a thread created under one non-empty `cl-*` or `uc-*` target on the published prototype retains the same ID and body through reply and resolve, and `comments.html` shows that same ID/body/final status | on the published URL serving `2afc138` or a descendant with unchanged target files, an operator with an existing allowlisted Google reviewer account records deployed SHA and timestamp, creates a thread under one `data-c`, records its ID, replies, resolves it, and confirms the same ID/body/status in `comments.html` | not read — no allowlisted Google reviewer session was available; no live create/reply/resolve/overview sequence occurred; the public response exposed no deployed Git SHA |

## Scope gates

- The closing report's non-canonical implementation-report format is outside inline discussion, review-page navigation, and English reviewer chrome. Auditing or repairing it requires a separate lifecycle-conformance gate; this report emits no finding for it.
- Stale pre-existing comments that still describe review “sheets” or lazy review-data fetching do not change the measured `OP-02` runtime observable. Editing them was outside the approved file boundary; any documentation cleanup requires a separate scope gate and is not promoted here.
- The other 14 findings returned by `finding_guard.py open` belong to earlier source reports. They are not part of this outcome review and were neither planned nor promoted.

## Cycle status

The target capability is locally observable for `OP-02` and `OP-03`, but the cycle success condition is **not met** because `EFF-01` remains open. The next iteration is limited to planning and executing the missing live observation after two gates are satisfied: the published URL serves the verified code, and an existing allowlisted reviewer session is available. No Firebase change is part of that iteration.

## Next step

`/impl-guide docs/audits/outcome-review-capability-delta-20260807-1325.md`

## Lossless-check status

`python3 /Users/mkoslacz/Workspaces/claude/claude-skills/outcome-review/references/finding_guard.py check --root . --base HEAD` failed because Git can reach only 3 of 22 lifecycle artifacts under this ignored `docs/` tree, including neither the source report nor this new report. The report has one `EFF-01` row, one matching expected-effect row, and `Scope: EFF-01`, but it remains ignored and uncommitted under the operator's no-commit boundary, so the no-loss guarantee does not cover it.

## Handoff
- Source: `docs/audits/design-prototype-capability-delta-20260807-1212.md`, `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227-verify-report-20260807-1313.md`
- Scope: `EFF-01`
- State: `reviewed`
- Evidence: `d5bf30b04edeb909c60a0f0755251d4b4ec893b5`; Codex in-app Browser observations at `http://127.0.0.1:8097/`; `node tools/test-review-capabilities.js` => static PASS then sandbox `EPERM`; public URL HEAD => HTTP 200 without deployed SHA; no live Firebase sign-in or operation
- Next: `/impl-guide docs/audits/outcome-review-capability-delta-20260807-1325.md`
