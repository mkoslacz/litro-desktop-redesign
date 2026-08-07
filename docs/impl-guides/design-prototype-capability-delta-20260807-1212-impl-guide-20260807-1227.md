# Implementation Guide — design-prototype capability delta

**Toolkit version:** 7.1.1
**Generated:** 2026-08-07 12:27:22 +0200
**Source:** `docs/audits/design-prototype-capability-delta-20260807-1212.md`
**Severity filter:** medium
**Target subjects:** inline document discussion, review-page navigation, reviewer-facing English chrome

## Scope and non-negotiable boundaries

This guide implements only `OP-01`, `OP-02`, and `OP-03` from the source report.
The existing `changelog.html`, `usecases.html`, and `comments.html` are extension points,
not pages to replace. `comments.html` remains the single overview of all threads.

- Keep one comment backend: every document action must use the existing `protoComments` API and its
  configured Firebase client. Do not add a store, authentication flow, config, collection, or Firestore rule.
- Do not modify `comments.rules`, `comments.config.json`, `comments.config.schema.json`, Firebase instructions,
  the mobile comment-toolbar footprint, `claude-skills`, package version, or `CHANGELOG.md`.
- Preserve `file://` as a readable, graceful no-op for fetched review data and comments; preserve `?nopanel=1`,
  all existing demo URL parameters, and the current Romanian/English product screens.
- The panel becomes navigation only for changelog, use cases, and comments. It must not render preview sheets
  or fetch their data.
- Reviewer-facing surfaces are English: the panel, comment sign-in copy, review hub, and the three review pages.
  Product-facing Romanian and English copy is out of scope.

## Triage and subject recurrence

| Finding | Severity | Subject | Prior target cycles | Decision |
|---|---|---|---:|---|
| `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-01` | ⚠️ med. | inline document discussion over the shared comment layer | 0 | card |
| `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-02` | ⚠️ med. | panel navigation to full review pages | 0 | card |
| `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-03` | ⚠️ med. | English reviewer-facing chrome | 0 | card |

No rejection, scope expansion, policy change, version bump, or non-convergent subject gate is proposed.

### IMPL-01: Mount stable inline discussions under changelog and use-case entries

**Source:** `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-01`
**Severity/Priority:** ⚠️ med.
**Workstream:** A — document discussion
**Reasoning tier:** high

#### Context

`changelog.html` and `usecases.html` already render their complete documents from sibling JSON files.
`proto-comments.js` already owns the Firebase client, reviewer identity, thread lifecycle, deep links, and
the shared overview. Document discussion must be a presentation over that layer, never a parallel client or
pin UI. The current `design-prototype` review-pages contract specifies `protoDiscussion.mount(layer)` after
the document render, with `protoComments.init({ overview: true })` so the document pages never create pins or
orphan writes.

#### What to do

1. Add `proto-discussion.js` and `proto-discussion.css` as a document-only inline discussion module. It receives
   the initialized existing comment layer, finds entries carrying `data-c`, and renders thread state, reply,
   resolve, and signed-out affordances under each entry. Use only the existing layer seam for reading and writing.
2. Give every rendered changelog card a stable data-derived anchor `data-c="cl-<entry.sha>"`; give every rendered
   use-case card `data-c="uc-<usecase.id>"`. Never derive identity from list position.
3. Load the discussion assets on both document pages. Start `protoComments` with `overview: true` only after the
   JSON renderer has inserted all `data-c` entries, then mount the module. Leave the existing `file://` branch as
   a quiet/readable no-op.
4. Translate all reviewer chrome touched in `changelog.html` and `usecases.html` to English. Preserve content
   read from changelog and use-case data in its source language.
5. Add focused checks that demonstrate: the module mounts only after entries exist; a data-derived anchor is used;
   discussion interactions delegate to the existing comment layer; and `?nopanel=1` stays irrelevant to full
   review pages without mutating the normal product flow.

Follow the patterns in: `proto-comments.js` (`CommentLayer`, `overview`, `setThreads`, existing error handling),
`comments.html` (overview rendering), and the review-page contract at
`/Users/mkoslacz/Workspaces/claude/claude-skills/design-prototype/references/design-prototype-review-pages.md`.

#### Scope

- Files: `changelog.html`, `usecases.html`
- New files: `proto-discussion.js`, `proto-discussion.css`
- Dependencies: none; must not touch Firebase configuration or rules

#### Definition of Done

- [ ] Each rendered changelog and use-case entry has a stable, data-derived `data-c` value.
- [ ] A discussion shown below an entry reads, starts, replies to, and resolves threads through the existing
  `protoComments` layer; no second backend, auth state, or store exists.
- [ ] A thread for an entry is visible under that entry and remains available to `comments.html` through the shared layer.
- [ ] The documents remain readable from `file://`; missing config or `file://` creates no comment UI side effects.
- [ ] Changelog and use-case reviewer chrome is English, while data content and product screens retain their own language.
- [ ] Focused behavioural checks pass.

#### Edge cases

- Empty or invalid JSON must keep the existing error message path and must not initialize discussion against an empty document.
- Entries without an ID/SHA must not receive a positional identifier or a misleading thread target.
- A signed-out reviewer sees an English sign-in affordance rather than a disabled write path.

#### Test scenarios

- **Behaviour:** with a fake existing comment layer, render a changelog entry and a use case, start a thread below each,
  reply, resolve, and assert the overview receives the same thread identities.
- **Regression:** open both review pages with `file://` semantics and confirm their document notice remains visible while
  no pins, toolbar, or orphan writes are attempted.

#### Dependencies

- Blocked by: none
- Blocks: IMPL-04

### IMPL-02: Replace review preview sheets with carried-query page links

**Source:** `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-02`
**Severity/Priority:** ⚠️ med.
**Workstream:** B — panel review navigation
**Reasoning tier:** standard

#### Context

`proto-sheets.js` currently fetches and renders compact changelog and use-case sheets, then offers a link beside
each preview. The full pages already contain the reading experience. The panel must instead expose exactly three
ordinary rows linking to `changelog.html`, `usecases.html`, and `comments.html`, carrying the panel state in the
query string. The links need to remain useful under `file://`; they must not fetch or render page copies.

#### What to do

1. Replace the content-sheet mount path with a small review-page row builder for the three existing pages. Remove
   the panel's sheet toggles, preview renderer, and review-data fetches rather than leaving duplicate UI behind.
2. Use one normalizer for the three link configurations and one carried-query function. It must preserve panel URL
   parameters, including `nopanel=1`, without inventing or overwriting values in the target URL.
3. Render English labels and accessible English link text for all three rows on desktop and mobile panels.
4. Keep the panel itself absent under `?nopanel=1`; this card must not change the export-mode branch, add fixed UI,
   or alter any mobile comment toolbar.
5. Add behavioural coverage for all three links from desktop and mobile panel mounts: non-empty link set, target
   pathname, preserved query parameters, no preview-sheet DOM, and no fetch of changelog/use-case data.

Follow the patterns in: the existing `withCarryQS()` helper in `proto-sheets.js`, `qs()` calls in `proto.js` and
`proto-m.js`, and the `pageLinkConfig` contract in the design-prototype review-pages reference.

#### Scope

- Files: `proto-sheets.js`, `proto-sheets.css`
- New files: none
- Dependencies: none

#### Definition of Done

- [ ] The desktop and mobile panels expose exactly three English review-page links.
- [ ] Every link opens its full existing page and carries the current demo query state.
- [ ] The panel contains no fetched changelog/use-case/comments preview sheet or duplicate document body.
- [ ] Link rendering works without fetch, including when the page itself is opened through `file://`.
- [ ] `?nopanel=1` still prevents panel construction and all existing URL parameters retain their semantics.
- [ ] Focused behavioural checks pass.

#### Edge cases

- Preserve target-page query values if a future configured target provides its own value.
- Keep fragments intact while carrying the panel state.
- Do not use `prototypeUrl` or a share-link base for these in-page review links.

#### Test scenarios

- **Desktop and mobile:** set multiple panel parameters, inspect all three links, and verify the exact pathname and
  resulting query parameters.
- **No duplication:** assert each link set is non-empty, no `.pt-sheet`/sheet toggle exists, and no review-data fetch occurs.

#### Dependencies

- Blocked by: none
- Blocks: IMPL-04

### IMPL-03: Make the remaining reviewer-facing surfaces English

**Source:** `docs/audits/design-prototype-capability-delta-20260807-1212.md#OP-03`
**Severity/Priority:** ⚠️ med.
**Workstream:** C — review hub and comment chrome
**Reasoning tier:** standard

#### Context

Reviewer chrome is a third language bucket: it is neither Romanian nor English product copy. The review hub,
comments overview, and sign-in/error family are therefore English independently of `document.documentElement.lang`.
The existing comment layer already supplies the shared string family; change it centrally without changing backend
behaviour or the product-facing screens that load it.

#### What to do

1. Translate reviewer-facing copy in `index.html` and `comments.html`, including labels, navigation, empty states,
   controls, error copy, and `file://` explanatory chrome, to clear English.
2. Make `proto-comments.js` reviewer controls and sign-in/error text English regardless of product-page language.
   Keep the existing public API, auth lifecycle, deep-link base split, and Firebase client untouched.
3. Translate the shared reviewer-page CSS comments/documentation only where this work changes a relevant contract;
   do not modify product CSS or product copy.
4. Add an explicit regression check over the exact reviewer-surface files that rejects Romanian reviewer chrome while
   allowing the Romanian/English product screen files to remain unchanged.

Follow the patterns in: `proto-comments.js` (`buildShell`, `signIn`, `showError`), `comments.html` overview controls,
`index.html` review hub section, and `proto-review.css` shared shell.

#### Scope

- Files: `index.html`, `comments.html`, `proto-comments.js`, `proto-review.css`
- New files: none
- Dependencies: none

#### Definition of Done

- [ ] The review hub, comments overview, and comment sign-in/error strings are English irrespective of page language.
- [ ] Existing Romanian/English product screens, their switches, and their user-visible product copy are unchanged.
- [ ] `comments.html` still initializes the one existing overview client with `overview: true` and renders its current
  controls and thread deep links.
- [ ] No Firebase policy, configuration, mobile toolbar footprint, or version/changelog change is made.
- [ ] Focused language and behaviour checks pass.

#### Edge cases

- The English rule applies to reviewer surfaces only; do not translate reviewer-authored thread content.
- Preserve the same-origin in-page deep-link behaviour and the separate copy/share-link behaviour.
- Keep missing configuration and `file://` as intentional non-destructive states.

#### Test scenarios

- **Chrome:** assert English reviewer labels on hub, all review pages, the panel, and comment sign-in paths.
- **Regression:** load a Romanian and an English product screen and assert their product-language content and URL controls remain unchanged.

#### Dependencies

- Blocked by: none
- Blocks: IMPL-04

### IMPL-04: Verify the capability upgrade end to end without live Firebase credentials

**Source:** `docs/audits/design-prototype-capability-delta-20260807-1212.md#{OP-01,OP-02,OP-03}`
**Severity/Priority:** ⚠️ med.
**Workstream:** D — capability regression checks
**Reasoning tier:** high

#### Context

The repository deliberately has no Firebase Admin credential, so a live reviewer sign-in cannot be claimed as
verified. The existing `createFirebaseClient` injection seam is the correct way to prove client-layer behaviour;
a plain injected store is not sufficient for write counting. The end-to-end check must prove local document,
navigation, and language behaviour without weakening the existing Firestore boundary.

#### What to do

1. Add a focused, repeatable capability check under `tools/` (or extend an existing test utility) that starts the
   local static server and uses the repository's browser tooling to inspect the full review pages and both panel
   variants.
2. Exercise the injected `createFirebaseClient` seam for inline discussion and the shared overview, recording that
   the same thread identity is rendered in both places without a second client.
3. Check the three panel links, carried URL state, absence of duplicate sheets, English reviewer chrome, `file://`
   fallback, and unchanged `?nopanel=1` panel suppression.
4. Run the generated-use-case validation and the full focused capability command. Do not access live Firebase,
   change its rules, or call the Admin CLI.

#### Scope

- Files: `tools/` capability test(s), only as needed for the focused checks
- New files: implementation-defined focused test file(s)
- Dependencies: IMPL-01, IMPL-02, IMPL-03

#### Definition of Done

- [ ] One repeatable command independently verifies the target capability and exits successfully.
- [ ] The command distinguishes the injected client seam from a live Firebase verification and reports that boundary.
- [ ] It proves non-empty review-link and discussion target sets before applying universal assertions.
- [ ] `node tools/build-usecases.js --no-capture` (or the repository's equivalent non-interactive validation) passes.
- [ ] No live credential, Firebase rule, scope, version, or product-screen change is required.

#### Test scenarios

- **Capability:** start a thread below a changelog entry and user story through the injected layer; verify that
  `comments.html` sees the same IDs and that reply/resolve actions retain them.
- **Navigation:** test all three full-page links in desktop and mobile panel context with a carried query string.
- **Export/file modes:** assert panel suppression under `?nopanel=1` and readable review-page fallback under `file://`.

#### Dependencies

- Blocked by: IMPL-01, IMPL-02, IMPL-03
- Blocks: nothing

## New patterns this guide introduces

| Pattern | Created by | Location | Used by |
|---|---|---|---|
| Document-level discussion over the shared comment layer | IMPL-01 | `proto-discussion.js` | `changelog.html`, `usecases.html` |
| Full-page review navigation from the demo panel | IMPL-02 | `proto-sheets.js` | desktop and mobile panel mounts |
| Focused capability regression boundary | IMPL-04 | `tools/` | implementation and independent verification |

## Execution plan

Runtime and workspace mode: resolved at execution time per `references/runtime-execution.md`.
Rounds are composed by tier and then split by disjoint file ownership.

### Round 1 — `standard` (parallel)

- **Agent 1 — Workstream B: panel review navigation** — IMPL-02 — files: `proto-sheets.js`, `proto-sheets.css` — complexity: M — reasoning: standard
- **Agent 2 — Workstream C: review hub and comment chrome** — IMPL-03 — files: `index.html`, `comments.html`, `proto-comments.js`, `proto-review.css` — complexity: M — reasoning: standard

### Round 2 — `high` (after Round 1)

- **Agent 3 — Workstream A: document discussion** — IMPL-01 — files: `changelog.html`, `usecases.html`, `proto-discussion.js`, `proto-discussion.css` — complexity: L — reasoning: high

### Round 3 — `high` (after Round 2)

- **Agent 4 — Workstream D: capability regression checks** — IMPL-04 — files: `tools/` focused test file(s) — complexity: M — reasoning: high

### Round 4 — Integration

Run the full focused capability checks, `node tools/build-usecases.js --no-capture`, static syntax checks for changed
JavaScript, and a manual browser walk of the hub, all three review pages, and one Romanian plus one English product screen.

| Round | Agents | Cards | Complexity | Reasoning | Dependencies |
|---|---:|---|---|---|---|
| 1 | 2 parallel | IMPL-02, IMPL-03 | M | standard | none |
| 2 | 1 | IMPL-01 | L | high | Round 1 (shared chrome should already be settled) |
| 3 | 1 | IMPL-04 | M | high | Round 2 |
| 4 | 1 sequential | integration | M | high | Round 3 |

## Handoff

- Source: `docs/audits/design-prototype-capability-delta-20260807-1212.md`
- Scope: `docs/audits/design-prototype-capability-delta-20260807-1212.md#{OP-01,OP-02,OP-03}`
- State: `planned`
- Evidence: `uncommitted guide; O(0) from finding_guard.py shows all three target findings as unplanned`
- Next: `/start-impl docs/impl-guides/design-prototype-capability-delta-20260807-1212-impl-guide-20260807-1227.md`
