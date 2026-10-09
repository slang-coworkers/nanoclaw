---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T22:29:07.616Z
---

# gh pr list --json mergeStateStatus 502s at --limit 100; fetch it per PR

In shader-slang/slang, `gh pr list --state open --limit 100 --json number,isDraft,headRefOid,mergeStateStatus` returns "HTTP 502 Bad Gateway (graphql)", which a retry loop mistakes for the OneCLI app_not_connected blip. Drop mergeStateStatus from the list call and read it per PR with `gh pr view N --json statusCheckRollup,mergeStateStatus`. The lighter list succeeds. Read stderr before assuming a proxy 401: the two failures look the same when stdout is empty.
