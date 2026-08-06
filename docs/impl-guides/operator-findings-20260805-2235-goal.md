# Goal — comments that can be read, and three review pages that can be handed to someone

**Toolkit version:** 6.0.1
**Generated:** 2026-08-05 22:42:00
**First guide:** `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md`

## Goal

A stakeholder can read and answer comments on the prototype from whatever origin they opened, and
can review the changelog, the product use cases and every open comment thread on three pages built
for reading — with the same capability shipped back into the `design-prototype` skill so the next
prototype starts with it.

## Business acceptance criteria

Goal-level and immutable for the whole loop. Not per-card DoD — `impl-verify` covers that; these
check the emergent outcome.

| ID | Criterion (observable) | How to verify |
|----|------------------------|---------------|
| BC-1 | Clicking a comment pin opens its thread, on whatever origin the reviewer is on — including `localhost:8080` while `prototypeUrl` points at the published site | Serve with `node tools/serve.js`; open a `#c=<id>` deep link; assert `document.querySelectorAll('.pc-messages article').length > 0` and no `SecurityError` in the console |
| BC-2 | A comment written on one screen draws a pin on that screen only | Open the RO and EN siblings of the commented screen; assert `.proto-comment-pin` count is 1 on the anchor page and 0 on the sibling, and that the thread is not in the detached tray |
| BC-3 | `changelog.html`, `usecases.html` and `comments.html` exist, are linked from `index.html` and from their panel sheets, and link back into the screens or states they describe | `curl -o /dev/null -w '%{http_code}'` each = 200; follow one link from each page and land on the described screen/state; check both directions of the hub and sheet links |
| BC-4 | The open-thread question is answerable in one place: every thread with author, body, replies and status, grouped by page | Signed in, open `comments.html`; thread count and bodies match what Firestore holds; the open/resolved filter changes the count |
| BC-5 | A prototype freshly built from the skill inherits the three pages and none of the five comment defects | In `/Users/mkoslacz/Workspaces/claude/claude-skills/design-prototype`: the three page templates exist and carry no product-specific copy; `templates/proto-comments.js` contains all five fixes; `SKILL.md` names the pages in the PHASE 0 inventory and in PHASE 7/11/12; both new gotchas are in the GOTCHAS table |

## Loop playbook (what each turn does)

1. `/start-impl` on the current guide.
2. `/impl-verify` — record completion %, open findings (crit/med/low).
3. **Business-verify** — check every BC above against the running prototype, and print a BC
   pass/fail table.
4. If open findings or unmet BC remain → `/impl-guide` (normal mode) on the latest
   `*-verify-report-*.md` to generate the next iteration's cards. Then continue.

## Surface every turn (so the evaluator can judge)

- Iteration number.
- impl-verify dashboard: completion %, findings crit/med/low.
- Weighted open findings = `3*crit + 2*med + 1*low`.
- BC pass/fail table.
- The integrity check below, passed or failed.

## Guardrails

- Max iterations: **4**.
- Stall: stop if weighted open findings did not strictly decrease for **2** consecutive iterations.
- Regression: a screen that loaded cleanly now throws, or a new critical finding this iteration → stop.
- No-progress: `/start-impl` implemented 0 cards → stop.
- **Integrity, adapted to this repository.** The prototype ships no automated test suite by design —
  it is static HTML that opens from `file://` (PHASE 4 of the skill). The standing "test count must
  not drop" rule therefore binds to the checks that do exist, and none of them may weaken:
  `node tools/refresh.js --fast` exits 0; `node tools/build-usecases.js --no-capture` still passes
  its validation (every state axis and option documented and covered); all 26 screens load with no
  console errors other than the known `comments.config.json` 404 when unconfigured; and
  `node tools/generate-fig.js prototype.json` still writes 38 frames with a zstd data chunk.
- Scope: never weaken the Firestore rules to make a criterion pass. The allowlist model is an
  operator decision from this session, not an obstacle.

## Iteration ledger (append one row per turn)

| Iter | Cards ✅/❌ | Completion | Open crit/med/low | Weighted | BC met | Regressions | Decision |
|------|-----------|------------|-------------------|----------|--------|-------------|----------|

## Handoff
- Source: `docs/audits/operator-findings-20260805-2235.md`
- Scope: the goal loop driving `docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md`; that guide holds the exact finding refs, this file holds only the immutable acceptance criteria
- State: `planned`
- Evidence: `uncommitted`
- Next: paste the emitted `/goal` condition to start the loop
