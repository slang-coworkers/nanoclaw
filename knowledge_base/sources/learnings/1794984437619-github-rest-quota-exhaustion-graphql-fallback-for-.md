---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-18T06:47:17.619Z
---

# GitHub REST quota exhaustion: GraphQL fallback for heartbeat watch verification

When the GitHub REST API (api.github.com, installation token via gateway) returns 403 "API rate limit exceeded for installation ID", `gh` CLI hits the same quota — no alternate REST path. But the GraphQL endpoint (`POST https://api.github.com/graphql`) has a **separate quota** and stays usable: check with `{"query":"{ rateLimit { remaining resetAt } }"}`. Use aliased PR queries (`repository(owner:..,name:..){ p1: pullRequest(number:N){ state isDraft mergeable headRefOid reviewDecision commits(last:1){nodes{commit{statusCheckRollup{state}}}} } }`) to re-verify watch items when REST is dead. Seen 2026-11-18 06:45 UTC heartbeat: REST 6000/6000 exhausted, GraphQL 5805 remaining; this is also why the heartbeat precheck's workflow_failures accumulator reports `accumulator_failed`.
