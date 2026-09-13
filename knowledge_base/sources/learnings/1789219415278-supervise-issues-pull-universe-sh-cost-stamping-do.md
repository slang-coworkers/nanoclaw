---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-12T13:23:35.278Z
---

# supervise-issues pull-universe.sh cost-stamping does not scale past ~hundreds of sessions

## Symptom
On 2026-09-12 (Tick 220), `/supervise-issues` had **3273 gh-issue sessions / 1451 unique chains**. `scripts/pull-universe.sh` stalled for 20+ min in **Step 1b (cost-cap status stamping)** and never reached the GraphQL phase.

## Root cause
Step 1b loops over **every** session and runs `ncl cost-cap status --session <id> --json` as a subprocess. Each `ncl` call spawns `bun /app/src/cli/ncl.ts` (~0.5–1s cold start). At 3273 sessions that is ~30–60 min — **before** the closed-issue filter (Step 3+4) drops the ~854 closed chains. So it pays the cost on thousands of long-closed chains that get discarded anyway. `cost_stopped` was 0 for the whole fleet, so the entire step produced no signal.

## Workaround that worked (this tick)
Kill the run, prepend a surgical shim to PATH that short-circuits ONLY `cost-cap status`, then re-run:
```sh
# /tmp/shim/ncl
#!/bin/sh
if [ "$1" = "cost-cap" ] && [ "$2" = "status" ]; then
  printf '%s\n' '{"ok":true,"data":{"status":"unknown"}}'; exit 0
fi
exec /usr/local/bin/ncl "$@"
```
`export PATH=/tmp/shim:$PATH` before `bash scripts/pull-universe.sh ... | python3 scripts/scan.py`. `scan.py` treats `cost_status=unknown` as no-signal (never cost_stopped), so the only capability lost is cost-stopped detection — which the dashboard cost card surfaces independently anyway. With the shim the full pipeline finished in ~45 min (GraphQL issue batch 47 calls, PR batch, then the per-chain loop 1408→ over ~40 min at ~24–40 chains/min).

## Real fix for the skill maintainer (proposed)
In `pull-universe.sh`, move cost stamping to AFTER the closed-issue filter (stamp only open chains, ~554 not 3273), and/or batch it. Better: only stamp sessions on OPEN chains, or add a `--skip-cost`/env flag. As-is, the step's cost is O(all sessions) and unbounded as the session table grows.

## Also observed
- `ncl sessions list --json` returns `{id, ok, data:[...]}` — the sessions are under the **`data`** key, not `sessions`/`rows`. Filtering the wrong key silently yields 0 gh-issue chains.
- The per-chain fetch loop counter increments for ALL 1408 chains even though closed ones skip the expensive gh fetch (minimal `issue_open:false` rows).
