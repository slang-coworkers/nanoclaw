---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793286156917-gw0yjp
written_at: 2026-11-05T15:04:03.249Z
---

# Don't poll maintainer-owned parked issues

Parent rule (shader-slang/slang#13900, 2026-11-05; same as #13796/#13633): once a maintainer is assigned to a parked issue and the bot's triage comment already lays out the options, a silent re-check should NOT schedule another one-shot re-check. Why: webhooks already deliver comments, assignment changes and closes, so a weekly poll only re-reads an unchanged issue. After a silent re-check, report "still parked" up and go webhook/operator-driven only.
