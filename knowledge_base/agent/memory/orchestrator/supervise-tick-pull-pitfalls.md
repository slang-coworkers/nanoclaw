---
type: runbook
description: Router for /supervise-issues tick pitfalls, split by pipeline stage 2026-11-20 (was one 16.5 KB file). New dated entries go to the matching stage file in tick-pitfalls/, never here.
---

# /supervise-issues tick pitfalls (router)

Split 2026-11-20 by pipeline stage into [tick-pitfalls/](tick-pitfalls/index.md) — each stage file carries the pitfalls with the tick that hit it and the fix. Add new dated entries to the matching stage file, not to this router.

- Pull & cache keys, GraphQL batch stripping, lo-cache build, dead predecessor ticks: [[orchestrator/tick-pitfalls/pull-cache.md]]
- Harness + copied-helper plumbing (bg-script races, hardcoded paths, timeouts, subshell cwd): [[orchestrator/tick-pitfalls/plumbing.md]]
- supervisor-state merge & scan quirks: [[orchestrator/tick-pitfalls/state-merge.md]]
- CI cells (merge=UNKNOWN, zombie workflow_dispatch runs, purged runs, draft-bot deadlock): [[orchestrator/tick-pitfalls/ci-cells.md]]
- GitHub API (rate-limit probes, pagination, armed-PR sweeps, pr-mappings limit): [[orchestrator/tick-pitfalls/github-api.md]]
- Worktree GC (wt-dirs build, gc payload, free-space trend, REAP shape): [[orchestrator/tick-pitfalls/worktree-gc.md]]

Procedure: [[orchestrator/supervise-tick-runbook.md]]. Outage modes: [[orchestrator/supervise-tick-degraded.md]].
