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

**Applied:** `rechase-13299-zero-width-4aa6` (12 unchanged status re-chases → final `rechase-13299-zero-width-048a` 11-06, then park webhook-only, 11-03); `rechase-12136-approver-j-fe1c` (8 asks → final) and `rechase-slang-12621-f194` (final at the 4th unchanged), 11-03; `rechase-13654-pr13681-a39d` (7 unchanged → final + file follow-ups, 11-02); `rechase-13126-pr13130-0b68` (5+ unchanged → final, 11-01); `rechase-slangpy-1204-pr1-d657` (7 reports → final, 11-01); `chase-13107-design-direc-98d5` (8 reminders → final, 10-31); `rechase-cla-bot-identity-10d0` (31 daily asks → weekly, change-only, 10-31); `chase-13726-ready-ask11-e4fb` (parked 10-27 19:07Z) and `chase-13413-ready-8524` (final ask about 11-06); `rechase-13434-undraft-292e` (11 asks → 12th announced final 11-01, park task `rechase-13434-final-park-7a47` 11-04).
`rechase-12714-layout-rul-*`: 4 unanswered asks, withdrawn as over-gated 11-02. Its 5th ask was in the task prompt's own decision table, and I overrode it under the leftover-gate rule; the no-ping nudge was posted by default. The 11-16 run parks the chain.
New re-ask tasks should carry the cap in their prompt from the start. **A task prompt's "ask once more" branch is not a reason to ask:** check first whether the menu offers the no-ping or no-gate default.
