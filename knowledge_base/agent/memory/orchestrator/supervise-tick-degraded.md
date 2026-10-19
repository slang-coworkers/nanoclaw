---
type: runbook
description: Degraded /supervise-issues ticks — probe GitHub and ncl first; the unauthenticated-REST path for a dead shader-slang credential (tick 285) and the NO_NCL pull for ncl congestion (tick 287). Split from the tick runbook 2026-10-18.
---

# /supervise-issues degraded ticks

Normal procedure: [[orchestrator/supervise-tick-runbook.md]]. Other pitfalls:
[[orchestrator/supervise-tick-pull-pitfalls.md]].

## Probe before pulling

- `gh api -i repos/shader-slang/slang` — a 401 "Bad credentials" while `repos/slang-coworkers/nanoclaw` returns 200
  means the shader-slang credential is dead (an `app_not_connected` from `gh api rate_limit` alone is **not** an outage).
- Time one `ncl sessions get <sid>` — over ~10 s or a timeout means `ncl` is congested.

## Dead shader-slang credential (tick 285, 2026-10-16)

- No GraphQL pull can run. **Escalate to the dashboard first** (failing step + exact error).
- Derive the chain universe from `ncl sessions`; find moved threads by diffing per-session `last_active` against the
  previous tick's `sessions.json`, and read the newest rows of each moved chain with `ncl sessions messages`. For
  GitHub state use **unauthenticated** public REST (`curl --noproxy '*'`, 60/h): enough for ~45 issues, ~11 PRs, a
  5-page auto-merge sweep and one `search/issues?q=org:shader-slang is:closed closed:>=<prev tick>`. Label the CI
  column n/a, journal new keys by hand, and set `_meta.degraded=true` so the next tick runs the full cached pull.
- **Hold nudges during the outage** — a nudged coworker can't post either, so the nudge only produces a second stall.
- A fire whose pull died mid-run (tick 285: 900/1965 after GraphQL TLS timeouts) leaves an empty `payload1.json`; the
  next batched turn must finish that tick, not skip it.

## `ncl` congestion (tick 287, 2026-10-16)

- **Symptom:** about half of all `ncl` calls hit the 30 s client timeout, so each cache miss (a `ncl sessions
  messages`) costs 30 s. Tick 287 reached 1560/1977 and was killed at the 40-min background cap; `payload1.json` is
  written only at the very end, so the work was lost.
- **Fix:** `tick287/pull-nocl.sh` with `NO_NCL=1` — a cache miss takes the previous lo-cache value and is marked
  `lo_stale`; the GraphQL part finishes in ~10 min. Then verify each flagged row by hand: retry `ncl sessions messages`
  (~1 in 2 succeed), and use `.claude-trace/session-<sid>.jsonl` `request.timestamp` and worktree mtimes for liveness.
- A fleet restart (127 sessions with `last_active` 11:31:14Z) moves `last_active` with no new rows, so `NO_NCL` loses
  little on those misses.
- **Don't `pkill -f <script>`** from a shell whose command line contains that name: it kills the relaunch too. Don't
  `sed 's/miss.json/miss2.json/'` either: the `.` matches and the rewrite corrupts `json.load(open('miss.json'))`.
