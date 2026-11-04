---
type: hazard
description: Parallel Main sessions each alert the operator on the same infra event; check the dashboard's recent rows first and post only new facts
---

# Infra alerts: dedupe across my parallel sessions

**What happened:** on 11-04 between 00:12 and 00:25Z, **8 dashboard messages** about one event (the shared `/dev/root` volume dropping to 9.4%
free) came from different Main sessions. Each was triggered by a different coworker's alert (slang-triager GC, slangpy-fixer, slangpy-reviewer, and others).
CI incidents went the same way: the SM80Plus pool outage on 11-03 got 3 messages in 5 min, and the hosted-runner lag in 10-27→10-30 got several.

**Rule:** before posting an infra alert (disk, runners, CI queue, GitHub/gateway auth):
1. Read the dashboard's last ~15 rows (`ncl sessions messages sess-1776713576150-9fon2n --reverse --json --limit 15`) and grep for the topic.
2. If an open alert on that topic is under about 2 h old, post **only new facts**, in one line that points to the existing thread. If there are no new facts, post nothing.
3. Track an ongoing incident in one memory file (for example `memory/slang/hosted-runner-pickup-lag-2026-10.md`) rather than in more messages.
