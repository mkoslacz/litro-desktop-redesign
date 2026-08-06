# Operator findings — comment layer defects and reviewer-facing review pages

**Toolkit version:** 6.0.1
**Generated:** 2026-08-05 22:35
**Source:** operator request (working session, 2026-08-05)
**Artifacts under review:** `desktop-redesign/` prototype (HEAD `c85e402`) and the
`design-prototype` skill at `/Users/mkoslacz/Workspaces/claude/claude-skills/design-prototype`
(HEAD `c8c8255`)

Five of the nine rows below are defects in the skill's own `templates/proto-comments.js`, found by
driving the freshly configured comment layer against a live Firebase project rather than by reading
the template. They reproduce in any prototype that installs it, so each row is fixed in both the
prototype copy and the template it came from.

## Findings

| ID | Severity | Area | Finding |
|---|---|---|---|
| OP-01 | critical | comments · navigation | `linkBase()` returns `config.prototypeUrl` in preference to the current document URL, and `openThread()` passes the result to `history.replaceState`. On any origin other than the configured one this throws `SecurityError: … cannot be created in a document with origin …`, `openThread` aborts before rendering, and the reviewer gets a pin that does nothing. Reproduced at `proto-comments.js:880` on `http://localhost:8080` with `prototypeUrl` set to `https://mateuszkoslacz.com/litro-desktop-redesign/`. The same base also makes the `needsRestore` branch `location.assign` a reviewer off their local copy onto the published site. |
| OP-02 | medium | comments · diagnosability | Three call sites discard the cause: `.catch(() => this.showError('This comment could not be opened.'))` at `proto-comments.js:691`, `:728` and `:899`. A Firestore rule rejection, an absent document and a cross-origin `SecurityError` all surface as one sentence, so OP-01 could not be diagnosed until the catch was widened by hand. |
| OP-03 | medium | comments · error surface | `showError()` sets `popover.hidden = false` but never positions the popover, so it keeps the coordinates of whatever was shown last. Measured at `rect=0,8941` on `listing-c-en.html` — roughly 9 000 px below the fold. The reviewer therefore sees neither the thread nor the error explaining its absence. |
| OP-04 | medium | comments · anchoring | `renderThreads()` skips a thread only when `elementFor(thread.anchor)` fails to resolve; it never compares `anchor.page` with the current page. Romanian and English screens are sibling files with identical structure, so a selector written on one resolves on the other and the pin is drawn on both. Observed: one pin rendered on `listing-c.html` for a thread whose anchor page is `listing-c-en.html`. |
| OP-05 | low | comments · layout | `positionPopover()` clamps `left` to `innerWidth - 18` without subtracting the popover's own width (`min(350px, 100vw - 36px)`), so a comment anchored in the right-hand third of a 1440 px screen renders most of the popover past the right edge. |
| OP-06 | medium | review surfaces | The changelog is readable only through a sheet inside the floating demo panel, capped at 25 entries in a ~280 px column. There is no page where a reviewer can read the whole history, filter it, or follow an entry to the screens it changed. |
| OP-07 | medium | review surfaces | The product use cases have the same problem and suffer more from it: ten scenarios, twelve state axes and twenty-nine documented options are compressed into the same narrow sheet, and `docs/usecases.md` is developer-facing Markdown with no styling, no state links and no captures inline. Neither surface is something a stakeholder can be handed. |
| OP-08 | medium | review surfaces | Stakeholder comments have no overview at all. A thread is reachable only by finding its pin on the screen it was written on, so nobody can see how many threads are open, what they say, or which screens carry them — exactly the question a workshop round opens with. |
| OP-09 | medium | skill | The five defects above and the three pages above exist only in this prototype. `design-prototype` ships the template that caused OP-01…OP-05 and describes only the panel sheets in PHASE 11 and PHASE 12, so the next prototype built from the skill reproduces every defect and lacks every page. |

## Expected effects

| Finding | Observable | Read how | Value at emission |
|---|---|---|---|
| `docs/audits/operator-findings-20260805-2235.md#OP-01` | clicking a pin opens its thread on the origin the reviewer is on | load a `#c=<id>` deep link on `localhost:8080`, read `.pc-messages article` count | `0` (popover shows the error text) |
| `docs/audits/operator-findings-20260805-2235.md#OP-02` | the console carries the underlying error object beside the reviewer-facing sentence | click a failing pin, read console for `[proto-comments] cause:` | absent |
| `docs/audits/operator-findings-20260805-2235.md#OP-03` | the error popover renders inside the viewport | `document.querySelector('.proto-comments-popover').getBoundingClientRect()` | `top = 8941` on a 1512×812 viewport |
| `docs/audits/operator-findings-20260805-2235.md#OP-04` | a thread anchored to one page draws no pin on a sibling page | open `listing-c.html`, count `.proto-comment-pin` for an EN-anchored thread | `1` (should be `0`) |
| `docs/audits/operator-findings-20260805-2235.md#OP-05` | the popover's right edge stays inside the viewport | anchor a comment at `rx > 0.8` on 1440 px, read `getBoundingClientRect().right` | overflows `innerWidth` |
| `docs/audits/operator-findings-20260805-2235.md#OP-06` | a standalone changelog page exists and is linked from hub and panel | `curl -o /dev/null -w '%{http_code}' localhost:8080/changelog.html` | `404` |
| `docs/audits/operator-findings-20260805-2235.md#OP-07` | a standalone use-case page exists and is linked from hub and panel | `curl -o /dev/null -w '%{http_code}' localhost:8080/usecases.html` | `404` |
| `docs/audits/operator-findings-20260805-2235.md#OP-08` | a standalone comments page exists and lists every thread | `curl -o /dev/null -w '%{http_code}' localhost:8080/comments.html` | `404` |
| `docs/audits/operator-findings-20260805-2235.md#OP-09` | the skill ships the three page templates and the five template fixes | `ls design-prototype/templates/` and grep PHASE 11/12 in `SKILL.md` | pages absent; template carries all five defects |

## Handoff
- Source: `operator request`
- Scope: `OP-01, OP-02, OP-03, OP-04, OP-05, OP-06, OP-07, OP-08, OP-09`
- State: `reviewed`
- Evidence: `uncommitted`
- Next: `/impl-guide docs/audits/operator-findings-20260805-2235.md --goal`
