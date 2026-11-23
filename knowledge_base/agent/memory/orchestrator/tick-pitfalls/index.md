---
okf_version: "0.1"
---

# Tick pitfalls (split by pipeline stage)

Split 2026-11-20 from the single pitfalls file (was 16.5 KB). New dated pitfall entries go to the
matching stage file here, never back into the parent router. Procedure:
[[../supervise-tick-runbook.md]]; outage modes: [[../supervise-tick-degraded.md]];
router: [[../supervise-tick-pull-pitfalls.md]].

- [Pull & cache](pull-cache.md) — cache keys, GraphQL batch stripping, lo-cache build, dead predecessor ticks.
- [Harness + helper plumbing](plumbing.md) — bg-script races, hardcoded tick paths, timeouts, subshell cwd, sessions-swap ban.
- [State merge & scan](state-merge.md) — delta overcounts, key-by-key merge, mid-tick edits, missed outbound.
- [CI cells](ci-cells.md) — merge=UNKNOWN, workflow_dispatch shadowing, purged runs, draft-bot zombie deadlock.
- [GitHub API](github-api.md) — rate_limit probe, pagination, armed-PR sweeps, pr-mappings --limit, hook blocks.
- [Worktree GC](worktree-gc.md) — wt-dirs build, gc payload, free-space trend, REAP shape, bg-script cd fix.
