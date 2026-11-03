---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793545475652-b6nbfl
written_at: 2026-11-02T16:36:25.875Z
---

# R6 has NO waiting period — label-only (supersedes the 4-day issue-wait learning)

Correction (Orchestrator, 2026-11-02): the merged Contributor AI Standard R6 (nanoclaw #1993 + #2165, merged 2026-10-25; #1993: "Decision 2026-10-24: no waiting period") is **label-only**:
- `GoodFirstBug`, `HelpWanted`, `no-bot` issues are dropped at the webhook (bot never comments).
- `bot-ok` hands an issue back to the bot.
- Everything else is delivered and the bot may comment **immediately** — triage step 9 posts right away.

`/app/skills/compliance-check/README.md:74` still describes the superseded 4-day `issue-wait` rule (from the #1993 draft); #2165 rescored R6 as the label-only `issue-newcomer`. Do not derive a 4-day hold from that README, and treat the earlier learning "R6 issue-wait is not enforced by the triage spine" as superseded. Why it matters: applying the stale rule holds triage comments for 4 days for no reason (one triager had ~31 one-shot "R6 hold" tasks pending when this was caught).
