---
title: "supervise-issues scan.py: awaiting_us false-positive modes (Tick 238, 7 of 9 nudges)"
type: learning
topic: agent-ops
source: learnings/1790044307828-supervise-issues-scan-py-awaiting-us-false-positiv.md
superseded_by: 1790126534976-supervise-issues-scan-py-awaiting-us-has-four-fals
---

# supervise-issues scan.py: awaiting_us false-positive modes (Tick 238, 7 of 9 nudges)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-22T02:31:47.828Z
---

# supervise-issues scan.py: awaiting_us false-positive modes (Tick 238, 7 of 9 nudges)

On Tick 238 (2026-09-22), 7 of 9 supervisor nudges were false positives or design-holds, not genuine stalls. The `awaiting_us` classification ("human spoke last, unanswered by us") and the fixer-owned carve-out have four recurring gaps worth fixing in `scripts/scan.py`:

1. **Bot logins are under-specified.** `bot_logins` defaults to only `nv-slang-bot[bot]`/`nv-slang-bot`. `coderabbitai`, `coderabbitai[bot]`, and `github-actions`/`github-actions[bot]` (board-sync + CI comments, many literally say "do not reply") are treated as HUMAN, so "human spoke last, unanswered" fires on pure bot chatter. Hit #13195 (only coderabbit/github-actions comments → nudged slang-reviewer) and contributed to #13200. **Fix:** add coderabbit + github-actions to the bot set (or a distinct ignore-list for board/CI bots).

2. **A maintainer APPROVE review is scored as an unanswered ask.** #13165: jkwak-work's 16:51Z review was an APPROVAL ("Looks good to me"), `review_comments: []`, no change requests — nothing to address. scan flagged it `awaiting_us` because the latest actor was a non-bot review. **Fix:** an APPROVE review with no change-requests/inline-comments is not "the ball in our court"; treat it as awaiting_human (merge-gated), not awaiting_us.

3. **Adjudicated hold-silent comments re-fire every tick.** #13203 (tangent-vector cmt 5768801018) and #13177 (minco3 cmt 5768900672) were both already adjudicated "hold-silent / no-post" hours earlier (design discussion addressed to the human dev team, no bot-directed ask, no @nv-slang-bot mention). The last-commenter-is-human heuristic re-flags them because the adjudication isn't visible to scan. Triager noted the "same false-positive pattern as #874/#13082." **Fix:** persist a per-comment "adjudicated no-post" marker (comment id) in supervisor-state and have scan suppress re-flag until a NEWER human comment lands; and/or down-weight comments that don't @-mention the bot and carry no question/gap/request.

4. **Design-gated holds nudge once on their first tick.** #13198, #13208, #13209 are maintainer-design-gated holds (fixer instructed "context-only, await go/no-go"), but their held dispositions weren't yet journaled in supervisor-state (new chains), so the carve-out fired. This is partly the intended discovery mechanism (the nudge elicits the status, then you journal the disposition), but 3 in one tick is noise. **Mitigation:** when the triager dispatches a fixer chain as HELD/context-only, journal the `advisory:maintainer-driving`/`stood-down` disposition into supervisor-state at dispatch time, not on first supervisor nudge.

Handling this tick: journaled dispositions for all 7 so future ticks park them; the 2 genuine actives were #13197 (finalizing behind the codex critique gate, PR imminent) and #13200 (complete, PR #13202 awaiting webhook CI un-yield + maintainer). Net: the "ball in our court" count the board showed (9) overstated genuine stalls by ~7.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790044307828-supervise-issues-scan-py-awaiting-us-false-positiv.md`_
