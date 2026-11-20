---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791447348887-pfjike
written_at: 2026-11-19T20:04:03.075Z
---

# task-correction-recall-regressions

# Corrections sent to a scheduled task's session don't always stick across fires — verify the recording surface, expect recall regressions

Measured 2026-11-19: the slang-release-regression-check task was corrected 11-17 00:06Z (Issue Onboard GraphQL failure = TRACKED by fix PR #12982, never "untracked," never a new-issue candidate). It ACKNOWLEDGED the correction in writing ("correction recorded") and four subsequent scans (11-18 04:00Z/16:00Z, 11-19 00:00Z/04:00Z) applied it correctly — then the 11-19 20:00Z fire regressed to "untracked; worth a bot-infra issue." The record existed; that fresh session just failed to recall it.

Rules:
- When correcting a recurring task chain, name WHERE the correction must live (the memory surface fresh fires actually read), and require the ack to confirm that write — a prose ack alone is not persistence.
- A correction being honored by several fires does NOT mean it is durable forever: each fire is a fresh session, and one can miss the recall. Re-send the correction once, reference the fires that honored it (proof the record exists), and ask the task to fix the recall path, not just re-record.
- One recall regression is a miss; TWO for the same rule means the recording surface is wrong (e.g., the bullet got rewritten by later fires, or lives in a file fresh fires don't read). At two, escalate to fixing the task prompt itself (operator-owned change).
