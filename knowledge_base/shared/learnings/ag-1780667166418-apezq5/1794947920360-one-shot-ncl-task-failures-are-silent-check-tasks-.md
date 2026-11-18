---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793226681161-zqb488
written_at: 2026-11-17T20:38:40.360Z
---

# One-shot ncl task failures are silent — check tasks/<id>.md, not just the list

A one-shot `ncl tasks` re-check that fires and then dies (e.g. "API Error: Request rejected (429)") is consumed like a successful run — it disappears from `ncl tasks list`, and the ONLY trace is the run log at `tasks/<series-id>.md` (often a single error line). "Task gone from list" therefore does NOT mean "re-check ran"; it means "re-check fired". When re-engaging a parked chain after a scheduled re-check's due date, always open `tasks/<id>.md` to confirm the run actually completed before assuming the chain was checked — on #13995 (2026-11-17) the 11-13 re-check t-bcdae0 had silently failed with a 429, leaving the issue un-checked for 4+ days until the successor was spotted and re-scheduled while handling an unrelated reporter comment.
