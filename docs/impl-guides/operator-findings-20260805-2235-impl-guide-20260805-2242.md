# Implementation guide — comment layer fixes and reviewer review pages

**Source:** `docs/audits/operator-findings-20260805-2235.md`
**Toolkit version:** 6.0.1
**Generated:** 2026-08-05 22:42
**Severity filter:** none (all nine findings carded)

Two repositories are in scope. Cards IMPL-1…IMPL-9 change the prototype at
`/Users/mkoslacz/Workspaces/claude/litoralul_nop_designs/desktop-redesign` (HEAD `c85e402`).
IMPL-10 changes the skill at `/Users/mkoslacz/Workspaces/claude/claude-skills/design-prototype`
(HEAD `c8c8255`) so the next prototype does not reproduce the same five defects.

**Triage note.** No finding was proposed for rejection; no `docs/audits/operator-decisions-*.md`
exists for this round. No subject here has consumed a prior cycle — all nine were emitted for the
first time in the 2026-08-05 session, so the non-convergence gate does not apply.

**State of play before execution.** OP-02 and OP-03 were already patched by hand in the prototype
copy during diagnosis (widening the catch was the only way to read the cause of OP-01). IMPL-2 and
IMPL-3 therefore start from a partial implementation: confirm it, complete it, and — the part that
is definitely not done — carry it to the skill template via IMPL-10.

---

### IMPL-1: Deep links must resolve against the origin the reviewer is on

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-01`
**Severity/Priority:** critical
**Workstream:** B — comment layer semantics
**Reasoning tier:** high

#### Context
`linkBase()` (`proto-comments.js:843`) returns `httpUrl(this.config.prototypeUrl || location.href)`,
so a configured `prototypeUrl` wins over the page actually open. `openThread()` then calls
`history.replaceState(null, '', this.deepLink(thread).href)` at `:880` with that cross-origin URL,
which throws `SecurityError` and aborts the method before any message renders. Reproduced on
`localhost:8080` against `prototypeUrl: https://mateuszkoslacz.com/litro-desktop-redesign/`.
The `needsRestore` branch has the mirror problem: `location.assign` sends a reviewer working
locally to the published site, where the comment layer may not even be configured.

There are genuinely two link kinds here and the code currently has one. In-page navigation and
history must stay same-origin; a link meant to be *pasted to someone else* should use
`prototypeUrl`. Separate them rather than deleting `prototypeUrl`.

#### What to do
1. Split the base: an origin-relative base for `replaceState` / `location.assign` / the
   `needsRestore` comparison, and `prototypeUrl` only where a shareable absolute link is produced
   (the copy-link affordance, and any link written into a dump by `tools/comments.js`).
2. Make the in-page path resilient regardless: a `replaceState` failure must never abort
   `openThread`. Wrap it so the thread still renders.
3. Check every other `linkBase()` caller for the same assumption before changing its meaning.

#### Scope
- Files: `proto-comments.js`
- New files: none

#### Definition of Done
- [ ] With `prototypeUrl` pointing at the published site, opening a `#c=<id>` deep link on
      `http://localhost:8080` renders the thread: `.pc-messages article` count > 0
- [ ] No `SecurityError` in the console on that path
- [ ] Clicking a pin never changes the page's origin
- [ ] A shareable link still carries the `prototypeUrl` origin
- [ ] A thrown `replaceState` degrades to a working popover, not an error popover

#### Edge cases
- `prototypeUrl` absent entirely (valid — it is optional in the schema)
- Prototype served from a sub-path (`/litro-desktop-redesign/`) rather than a domain root
- `file://`, where the layer already returns early

#### Test scenarios
- **Integration:** same thread id opened on localhost and on the published origin — both render.

#### Dependencies
- Blocked by: none
- Blocks: IMPL-9 (the comments page reuses the link logic)

---

### IMPL-2: Surface the cause behind "This comment could not be opened."

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-02`
**Severity/Priority:** medium
**Workstream:** A — comment layer mechanics
**Reasoning tier:** economy

#### Context
Three sites (`:691`, `:728`, `:899`) used `.catch(() => this.showError('…'))`, collapsing every
failure into one sentence. A partial fix is already in the working tree: the catches now pass the
error and `showError(message, cause)` logs it. Confirm it, and make sure nothing else swallows.

#### What to do
1. Verify the three call sites and `showError` in the working tree do what the DoD says.
2. Sweep the file for other `catch` handlers that discard a cause on a reviewer-visible path and
   give them the same treatment. Leave the deliberate silent no-ops (absent config, `file://`) alone.

#### Scope
- Files: `proto-comments.js`

#### Definition of Done
- [ ] A failing pin logs `[proto-comments] cause:` with the error object and its `code`
- [ ] The reviewer-facing sentence is unchanged
- [ ] Absent config and `file://` remain quiet — no new console noise on a normal load

#### Dependencies
- Blocked by: none
- Blocks: nothing

---

### IMPL-3: The error popover must render inside the viewport

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-03`
**Severity/Priority:** medium
**Workstream:** A — comment layer mechanics
**Reasoning tier:** economy

#### Context
`showError()` unhides the popover without positioning it, so it keeps the last coordinates set.
Measured at `top = 8941px` on `listing-c-en.html`: the reviewer saw a dead pin and no explanation.
A partial fix (centre it) is in the working tree; confirm and harden.

#### What to do
1. Confirm `showError` positions the popover centrally and that the centring survives a later
   `positionPins()` pass, which calls `positionPopover` when the popover is visible.
2. Make sure an error popover is dismissible — it currently replaces all children, including the
   close button.

#### Scope
- Files: `proto-comments.js`, `proto-comments.css`

#### Definition of Done
- [ ] After a failed open, `getBoundingClientRect()` of the popover lies fully within the viewport
- [ ] The error popover can be closed without reloading
- [ ] Scrolling after an error does not move the error popover off-screen

#### Dependencies
- Blocked by: none
- Blocks: nothing

---

### IMPL-4: A pin belongs to the page its comment was written on

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-04`
**Severity/Priority:** medium
**Workstream:** B — comment layer semantics
**Reasoning tier:** high

#### Context
`renderThreads()` (`:673`) drops a thread only when `elementFor(thread.anchor)` fails. It never
compares `anchor.page` to the current page. RO and EN screens are structurally identical siblings,
so a selector written on one resolves on the other: a thread anchored to `listing-c-en.html` drew a
pin on `listing-c.html`. Observed directly. The same will happen between `listing-c.html` and
`listing-b.html` wherever markup was copied.

Be careful what "same page" means here. The anchor also records `viewport` and `lang`, and the
mobile file set is a different page entirely (`m-listing.html`), so page identity is the file, not
the flow step. Threads for other pages must not simply vanish — they are the natural content of the
comments overview page (IMPL-9), and the detached tray already exists for a related purpose.

#### What to do
1. Filter pin rendering on `anchor.page` against the current page name.
2. Decide, and write down in a comment, what happens to a thread belonging to another page: it
   should not be a pin here, and it should not be misfiled as "detached" — detached means the
   anchor broke, which is a different fact.
3. Keep `openHashThread` working: arriving via `#c=<id>` for another page must still restore.

#### Scope
- Files: `proto-comments.js`

#### Definition of Done
- [ ] A thread anchored to `listing-c-en.html` renders zero pins on `listing-c.html`
- [ ] It renders exactly one pin on `listing-c-en.html`
- [ ] It does not appear in the detached tray on either page
- [ ] A `#c=<id>` deep link for another page still restores that page and opens the thread

#### Edge cases
- Threads whose anchor page no longer exists in the prototype
- The archive variants (`home.html`, `home-b.html`) sharing markup with `home-c.html`

#### Dependencies
- Blocked by: none
- Blocks: IMPL-9

---

### IMPL-5: Clamp the popover by its own width, not just its left edge

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-05`
**Severity/Priority:** low
**Workstream:** A — comment layer mechanics
**Reasoning tier:** economy

#### Context
`positionPopover()` (`:829`) clamps `left` to `Math.min(innerWidth - 18, …)` but the popover is
`min(350px, 100vw - 36px)` wide, so an anchor at `rx > 0.8` on 1440 px leaves most of it off-screen.
The same applies to `top` against the popover's height.

#### What to do
Measure the popover and clamp both axes so the whole box stays inside the viewport; flip it to the
other side of the anchor when there is no room, rather than merely sliding it.

#### Scope
- Files: `proto-comments.js`

#### Definition of Done
- [ ] A comment anchored at the far right of a 1440 px screen renders fully inside the viewport
- [ ] Same at the bottom edge
- [ ] The popover still points at its anchor rather than jumping to the screen centre

#### Dependencies
- Blocked by: none
- Blocks: nothing

---

### IMPL-6: A shared shell for the three review pages

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-06`, `docs/audits/operator-findings-20260805-2235.md#OP-07`, `docs/audits/operator-findings-20260805-2235.md#OP-08`
**Severity/Priority:** medium
**Workstream:** C — review page foundation
**Reasoning tier:** high

#### Context
Three standalone pages are coming (IMPL-7/8/9). They must look like one family, must not be
mistaken for the product, and must be reachable both ways: hub → page, panel sheet → page, and page
→ the screen or state each row describes. Building that shell once is what stops three pages from
becoming three private stylesheets.

These pages are prototype scaffolding, not product screens: style them like the review hub
(`index.html`), not like `litro.css` components. They are also static-first — they must open from
`file://` with the same graceful degradation the panel sheets have, since `fetch` of a sibling JSON
is blocked there.

#### What to do
1. Add one stylesheet for the review pages, reusing the hub's visual language. Keep it out of
   `litro.css` — that file is handoff material for developers.
2. Establish the page shell: title, one-line statement of what the page is, a back-link to the hub,
   and a shared nav strip linking the three review pages to each other.
3. Add a "review pages" section to `index.html` linking all three.
4. In `proto-sheets.js`, give each panel sheet a link to its full page, so the narrow sheet becomes
   a preview rather than the only surface. Keep the sheets working exactly as they do now.
5. Decide the `file://` story once, in the shell, so all three pages inherit it.

#### Scope
- Files: `index.html`, `proto-sheets.js`, `proto-sheets.css`
- New files: one review-page stylesheet; name it in the same idiom as the existing files

#### Definition of Done
- [ ] The hub links all three review pages
- [ ] Each panel sheet carries a link to its full page
- [ ] The shell renders identically in RO and EN
- [ ] Opened from `file://` the pages explain themselves instead of failing silently
- [ ] No review-page CSS leaks into `litro.css`

#### Dependencies
- Blocked by: none
- Blocks: IMPL-7, IMPL-8, IMPL-9

---

### IMPL-7: `changelog.html` — the whole history, readable

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-06`
**Severity/Priority:** medium
**Workstream:** D — changelog page
**Reasoning tier:** standard

#### Context
`changelog.json` holds 48 entries with subject, body, date, touched screens and commit URL. The
panel sheet shows 25 of them, subject-only, in a ~280 px column. The body — which is where the
reasoning for each round lives — is never displayed anywhere.

#### What to do
Build a full-width page over the same `changelog.json`: entries newest first, grouped by round,
showing the body as well as the subject, with the touched screens as working links and the commit
short SHA linking to GitHub. Give it enough affordance to be used in a workshop — at minimum a way
to jump to a round.

#### Scope
- Files: new `changelog.html`
- Reads: `changelog.json` (do not change its shape; `tools/build-changelog.js` owns it)

#### Definition of Done
- [ ] All 48 entries render, newest first
- [ ] Each entry shows its body text, not only the subject
- [ ] Screen links open the screen; commit links open GitHub
- [ ] Linked from the hub and from the changelog panel sheet
- [ ] No horizontal scroll at 1440 px or at 390 px

#### Dependencies
- Blocked by: IMPL-6
- Blocks: nothing

---

### IMPL-8: `usecases.html` — the state matrix as a product document

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-07`
**Severity/Priority:** medium
**Workstream:** E — use-case page
**Reasoning tier:** standard

#### Context
`usecases.built.json` carries ten use cases, twelve state axes, twenty-nine documented options,
per-screen deep links, and 22 captures under `docs/usecases/`. Today a stakeholder can reach that
only as a cramped panel sheet or as raw Markdown. This is the page most likely to be sent to
someone who was not in the workshop.

#### What to do
Build a page over `usecases.built.json`: each use case with its name, story, rules, resolved state
line, deep links per screen, and its capture. Add the full state reference — every axis, every
option, every `doc` — as a section a developer can link into. Link to `docs/usecases.md` for the
developer-facing version rather than duplicating its role.

#### Scope
- Files: new `usecases.html`
- Reads: `usecases.built.json`, captures under `docs/usecases/`

#### Definition of Done
- [ ] All ten use cases render with story, rules and resolved state
- [ ] Every deep link opens the pinned state and carries no `nopanel=1`
- [ ] All twelve axes and twenty-nine options appear in the state reference
- [ ] Captures are lazy-loaded — the set is ~61 MB
- [ ] Linked from the hub and from the use-case panel sheet

#### Edge cases
- A use case whose capture is missing (captures may be gitignored on a fresh clone)

#### Dependencies
- Blocked by: IMPL-6
- Blocks: nothing

---

### IMPL-9: `comments.html` — every thread in one place

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-08`
**Severity/Priority:** medium
**Workstream:** F — comments page
**Reasoning tier:** standard

#### Context
A thread is reachable only by finding its pin on the screen it was written on. Nobody can answer
"how many threads are open, and what do they say" — the question every workshop round starts with.
IMPL-4 makes this page necessary as well as useful: once pins are page-scoped, this is the only
surface that shows all threads at once.

This page reads live Firestore through the same configured layer, so it needs sign-in and it must
degrade exactly as the screens do: quiet when unconfigured, quiet on `file://`.

#### What to do
1. Reuse the existing comment layer's store rather than writing a second Firebase client.
2. List every thread grouped by page: author, timestamp, body, replies, status, and the anchor
   label so a reader knows what was being pointed at.
3. Each thread links to its `#c=<id>` deep link, which after IMPL-1 opens correctly on whatever
   origin the reader is on.
4. Offer at least open/resolved filtering, and show a count.
5. Do not add a delete affordance — the rules forbid deletion and workshop mode archives.

#### Scope
- Files: new `comments.html`
- Reads: `comments.config.json`, the comment layer's store

#### Definition of Done
- [ ] Signed in, every thread appears grouped by page, with body and replies
- [ ] Open/resolved filter and a visible count
- [ ] Each thread deep-links to its pin and opens it on the current origin
- [ ] Signed out, the page explains how to sign in instead of appearing empty
- [ ] Unconfigured or `file://`, the page says so plainly
- [ ] No second Firebase initialisation

#### Edge cases
- A thread whose anchor page no longer exists
- Threads the reviewer's allowlist entry does not permit reading — a rule rejection must read as a
  rule rejection, which is what IMPL-2 makes possible

#### Dependencies
- Blocked by: IMPL-6, IMPL-1, IMPL-4
- Blocks: nothing

---

### IMPL-10: Carry all of it back into the `design-prototype` skill

**Source:** `docs/audits/operator-findings-20260805-2235.md#OP-09`
**Severity/Priority:** medium
**Workstream:** G — skill
**Reasoning tier:** high

#### Context
`templates/proto-comments.js` in the skill is the origin of OP-01…OP-05; every prototype built from
it inherits all five. The three review pages are likewise a general capability, not a LITRO one —
PHASE 11 and PHASE 12 currently describe only the panel sheets, and PHASE 7 describes only the hub.

The skill is a separate repository at
`/Users/mkoslacz/Workspaces/claude/claude-skills/design-prototype` (HEAD `c8c8255`).

#### What to do
1. Port the five fixes into `templates/proto-comments.js`, keeping the template's own idiom.
2. Add the three review pages as templates, generic over the prototype (no LITRO names, no
   Romanian). They must work against the same generated files the skill already defines:
   `changelog.json`, `usecases.built.json`, `comments.config.json`.
3. Update `SKILL.md`: the review pages belong in the contract — the artifact-state inventory in
   PHASE 0 that lists what "present" means, PHASE 7 (the hub links them), PHASE 11 (comments
   overview) and PHASE 12 (use-case page). Add the two gotchas this round produced to the GOTCHAS
   table: a deep link built from a configured absolute URL breaks `replaceState` cross-origin, and
   an unpositioned error popover inherits stale coordinates.
4. Keep the changes proportionate to the skill's existing prose density; do not restate the
   prototype's specifics.

#### Scope
- Files (other repo): `design-prototype/templates/proto-comments.js`, `design-prototype/SKILL.md`
- New files (other repo): three page templates under `design-prototype/templates/`

#### Definition of Done
- [ ] All five fixes present in the template, matching the prototype's behaviour
- [ ] Three page templates exist and contain no product-specific names or copy
- [ ] `SKILL.md` names the pages in the artifact-state inventory and in PHASE 7/11/12
- [ ] Both new gotchas are in the GOTCHAS table
- [ ] The skill's own test suite, if it covers these templates, still passes

#### Dependencies
- Blocked by: IMPL-1, IMPL-2, IMPL-3, IMPL-4, IMPL-5, IMPL-7, IMPL-8, IMPL-9
- Blocks: nothing

---

## New Patterns This Guide Introduces

| Pattern | Created by | Location | Used by |
|---------|-----------|----------|---------|
| Review-page shell (stylesheet, nav strip, hub section, sheet→page links) | IMPL-6 | new review-page stylesheet + `index.html` + `proto-sheets.js` | IMPL-7, IMPL-8, IMPL-9 |
| Two link kinds: same-origin in-page vs shareable absolute | IMPL-1 | `proto-comments.js` | IMPL-9, IMPL-10 |

---

## Execution plan

Runtime and workspace mode: resolved at execution time per `references/runtime-execution.md`.
Rounds are composed by tier, then split by file ownership. Every agent below owns exactly the files
listed for it; no path is owned by two agents in the same round.

### Round 1 — `economy` (single agent)
- **Agent 1 — Workstream A: comment layer mechanics** — IMPL-2, IMPL-3, IMPL-5 — files: `proto-comments.js`, `proto-comments.css` — complexity: S — reasoning: economy

### Round 2 — `high` (parallel; after Round 1)
- **Agent 2 — Workstream B: comment layer semantics** — IMPL-1, IMPL-4 — files: `proto-comments.js` — complexity: M — reasoning: high
- **Agent 3 — Workstream C: review page foundation** — IMPL-6 — files: `index.html`, `proto-sheets.js`, `proto-sheets.css`, new review-page stylesheet — complexity: M — reasoning: high

### Round 3 — `standard` (parallel; after Round 2)
- **Agent 4 — Workstream D: changelog page** — IMPL-7 — files: `changelog.html` — complexity: S — reasoning: standard
- **Agent 5 — Workstream E: use-case page** — IMPL-8 — files: `usecases.html` — complexity: M — reasoning: standard
- **Agent 6 — Workstream F: comments page** — IMPL-9 — files: `comments.html` — complexity: M — reasoning: standard

### Round 4 — `high` (after Round 3)
- **Agent 7 — Workstream G: skill** — IMPL-10 — files: `design-prototype/templates/*`, `design-prototype/SKILL.md` (separate repository) — complexity: L — reasoning: high

### Round 5 (sequential) — Integration
- Walk the flow in a real browser at both viewports and both languages; open a pin on localhost and
  on the published origin; open all three review pages; re-run `node tools/refresh.js --fast`.

| Round | Agents | Cards | Complexity | Reasoning | Dependencies |
|-------|--------|-------|------------|-----------|--------------|
| 1 | 1 | 3 | S | economy | none |
| 2 | 2 | 3 | M | high | Round 1 |
| 3 | 3 | 3 | M | standard | Round 2 |
| 4 | 1 | 1 | L | high | Round 3 |
| 5 | 1 sequential | integration | S | high | Round 4 |

Round 2 places IMPL-1/IMPL-4 and IMPL-6 in one round because their file sets are disjoint and both
resolve to `high`; no tier uplift is paid by any card.

## Handoff
- Source: `docs/audits/operator-findings-20260805-2235.md`
- Scope: `docs/audits/operator-findings-20260805-2235.md#{OP-01,OP-02,OP-03,OP-04,OP-05,OP-06,OP-07,OP-08,OP-09}`
- State: `planned`
- Evidence: `uncommitted`
- Next: `/start-impl docs/impl-guides/operator-findings-20260805-2235-impl-guide-20260805-2242.md`
