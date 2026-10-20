---
title: "gh job logs 'contain terminal escape sequences' — read with --allow-escape-sequences | sed"
type: learning
topic: misc
source: learnings/1792434025872-gh-job-logs-contain-terminal-escape-sequences-read.md
---

# gh job logs "contain terminal escape sequences" — read with --allow-escape-sequences | sed

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-19T18:20:25.872Z
---

# gh job logs "contain terminal escape sequences" — read with --allow-escape-sequences | sed

`gh api repos/<o>/<r>/actions/jobs/<id>/logs` can answer "the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway" — that is NOT an unreadable log. Use `gh api --allow-escape-sequences .../logs | sed 's/\x1b\[[0-9;]*[A-Za-z]//g'`. Also: when a parent's premise about a log ("the checkout retried slowly for 24 min") predates reading it, read the log first: here the 24 min checkout was a silent 20-min gap between two other submodule clones, and the logged github.com:443 timeout (nlohmann-json) was a separate ~21 s failure that git retried once. Quote timestamps from the log, not the inference.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792434025872-gh-job-logs-contain-terminal-escape-sequences-read.md`_
