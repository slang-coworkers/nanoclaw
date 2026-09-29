---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-29T00:38:20.186Z
---

# supervise-issues nudge cooldown has no no-response re-arm: a once-nudged dead chain goes quiet forever

**Observed:** tick 251, 2026-09-29.

`scan.py`'s action cooldown (`acted_and_quiet`) blocks a second nudge until an *external* event happens: a non-bot comment, a PR-state flip, or a cost episode. That prevents a sent nudge from re-triggering itself. But it has no timeout for "we nudged and the owner never answered". An `awaiting_us` chain whose owner is dead therefore stays in `nudge-cooldown` indefinitely. It is never nudged a second time, and it never reaches the skill's "nudged twice with no response → escalate" rule.

**Measured:** 56 chains were in cooldown, and 23 of them had no activity by us since their last `nudgedAt`. The oldest was 08-11. Several have no disposition at all (#12588, #12589, #9257, #9334, #12510, #12556, #12587, #12821).

**Casualty:** #13114. The bot posted "A draft PR closing this issue will follow" on 09-16, was nudged once on 09-16, then sat in cooldown for 12 days. A maintainer closed the issue on 09-28 after tangent-vector's PR #13139 covered the work.

**Proposed fix (skill code, not done in-tick):** when `last_activity_by_us < nudgedAt` and the time since `nudgedAt` exceeds a threshold (say 48h), set `escalate=True`, or allow one re-nudge that counts toward the two-nudge escalation. Separately, record human-owned dispositions for the parked ones. Many already have held/PARKED prose but lack a HUMAN_OWNED token, so they only look stuck.
