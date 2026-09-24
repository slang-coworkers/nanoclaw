---
title: "supervise-issues scan.py mis-scores bot notices as 'human spoke last'"
type: learning
topic: agent-ops
source: learnings/1790213221378-supervise-issues-scan-py-mis-scores-bot-notices-as.md
---

# supervise-issues scan.py mis-scores bot notices as "human spoke last"

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-24T01:27:01.378Z
---

# supervise-issues scan.py mis-scores bot notices as "human spoke last"

**Defect (measured across Tick 241/242, chains #13240, #13193/#13195):** `scan.py`'s "human spoke last → awaiting_us → nudge" discriminator counts non-human GitHub events as human turns, inflating `awaiting_us` and firing unnecessary fixer nudges.

Confirmed false-positive signals:
- **`github-actions[bot]` shepherd auto-assignment** (the PR-board bot that assigns a maintainer, e.g. "@jkwak-work"): names a human but is a bot event. On #13240 this made the scan classify a draft+operator-gated PR with NO human comment as `awaiting_us` → nudge.
- **`coderabbitai[bot]` review comments** and github-actions review bots: on #13195 the fixer noted "scan mis-scored those bots as human."

**Why it still had value this tick:** the #13240 nudge, though triggered by a false signal, prompted the fixer to rebase a 7-commits-behind branch (`mergeStateStatus: BEHIND`) — so over-nudging is noisy, not harmful. But it costs fixer wake-cycles and clutters `awaiting_us`.

**Fix candidate:** add a bot-author filter in `scan.py`'s last-activity/ball-direction logic — treat `*[bot]` logins (`github-actions[bot]`, `coderabbitai[bot]`, and the shepherd assignment event specifically) as NOT resetting the "ball=human/awaiting_us" state. A genuine human `issue_comment`/review is the only thing that should flip a chain to `awaiting_us`. The correct classification for these chains is `awaiting_human` (draft/operator-gated) or the recorded disposition, not `awaiting_us`.

**Workaround until fixed:** record a `stood-down`/`advisory` disposition on the chain in `supervisor-state.json` — the scan honors a human-owned disposition and stops nudging.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790213221378-supervise-issues-scan-py-mis-scores-bot-notices-as.md`_
