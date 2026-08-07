# Implementation Report — design-prototype capability delta

**Guide:** `docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md`
**Source:** `docs/audits/design-prototype-capability-delta-20260807-1212.md`
**Completed:** 2026-08-07 13:05 +0200
**Scope:** `OP-01`, `OP-02`, `OP-03` only

## Delivery summary

| Card | Result | Evidence |
|---|---|---|
| `IMPL-01` — inline document discussion | complete | `changelog.html` and `usecases.html` render stable `cl-<sha>` / `uc-<id>` anchors, then mount `protoDiscussion` through `protoComments.init({ overview: true })`. |
| `IMPL-02` — review navigation | complete | `proto-sheets.js` now renders exactly three ordinary full-page links and carries the current query without a review-data fetch or preview sheet. |
| `IMPL-03` — reviewer chrome | complete | Hub, review pages, panel navigation, comments overview and shared comment chrome are English; product RO/EN screens were not changed. |
| `IMPL-04` — focused capability check | complete | `tools/test-review-capabilities.js` covers panel links, `nopanel`, inline lifecycle, one shared overview, signed-out and `file://` paths with an injected existing-client seam. |

## Changed artifacts

- `proto-sheets.js`, `proto-sheets.css`
- `index.html`, `comments.html`, `proto-comments.js`, `proto-review.css`
- `changelog.html`, `usecases.html`, `proto-discussion.js`, `proto-discussion.css`
- `tools/test-review-capabilities.js`
- `CLAUDE.md` — records the document-discussion invariant and the focused proof command.

No Firebase rule, Firebase configuration/instruction, mobile comment toolbar, package version, `CHANGELOG.md`, `claude-skills`, product screen, or replacement review page changed.

## Runtime record

Shared-workspace implementation was split by file ownership:

- Workstreams B and C: `gpt-5.6-sol` / high; base `aaa7f17`.
- Workstream A: `gpt-5.6-sol` / xhigh; base `4af2641`.
- Workstream D: `gpt-5.6-sol` / xhigh; base `eb75e95`.

The repository's `npm test` remains its pre-existing placeholder command, so it cannot evidence this change. The focused capability command below is the executable verification surface.

## Verification performed

```text
node tools/test-review-capabilities.js
PASS static contracts: one comment facade, no panel sheets/fetch, English reviewer chrome
PASS panel navigation: desktop/mobile, three links, carried query/fragment, no duplicate sheets
PASS export mode: desktop/mobile nopanel suppression unchanged
PASS discussions: stable cl-/uc- targets, start/reply/resolve, same IDs in comments overview
PASS signed-out path: English comments-page affordance, zero writes
PASS file:// fallback: readable notices, zero comment initialization or UI side effects
BOUNDARY injected createFirebaseClient only; live Firebase was neither contacted nor verified.
RESULT review capability checks passed
```

The command creates a temporary `127.0.0.1:0` server, blocks external requests and closes it in `finally`.
It deliberately never contacts Firebase. `node tools/build-usecases.js --no-capture` also passed (10
use cases, 0 captures); its timestamp-only generated output was restored after validation.

Additional checks passed:

```text
node --check proto-sheets.js
node --check proto-comments.js
node --check proto-discussion.js
node --check tools/test-review-capabilities.js
git diff --check
```

An interactive browser walk was not available in this sandbox: its policy blocks local `file://`, and the
existing preview server listens on all interfaces. This was not bypassed or changed; the focused browser
test above uses its isolated loopback server instead.

## Boundary and handoff

The shipped evidence verifies the client contract and non-destructive `file://` fallback, not an allowlisted
reviewer's live Google sign-in or a live Firestore write. Fresh verification should assess the four cards against
this implementation and report any direct descendant finding under the same `OP-01`–`OP-03` subjects.
