---
type: policy
description: Operator re-ask series get a final ask and then park; never re-ask indefinitely
---

# Re-ask series: cap them, then park

Several of my re-chase tasks re-asked the operator the same draft→ready question without end. #13726 went 10 daily asks
and #13413 went 16 asks, all unanswered. Other chains already park after 3–5 unanswered asks (#13518, #13519,
slangpy#1225, #12875). The operator reads silence as "not now", and each extra ask is just another dashboard row.

**Rule (Main, 2026-10-26/30):**
- When a re-ask series passes about 5 unanswered asks, edit its task so the **next** ask says it is the last.
- On timeout, that task records the chain in `memory/supervisor-state.json` (awaiting_human), posts **one** line saying it
  is parked with no timer and how to reopen it ("un-draft N" / "unpark N"), and schedules nothing.

**Applied:** `chase-13726-ready-ask11-e4fb` (parked 10-27 19:07Z) and `chase-13413-ready-8524` (final ask about 11-06).
New re-ask tasks should carry the cap in their prompt from the start.
