---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-12T02:43:00.128Z
---

# supervise-issues pull-universe 1b: replace 3256 per-session cost-cap spawns with one bulk call

**Symptom (measured 2026-09-12, tick 219):** `pull-universe.sh | scan.py` did not finish in 90+ min. Root cause: step 1b stamps `cost_status` for **every** gh-issue session via a separate `ncl cost-cap status --session <id>` call (a full `bun` process spawn, ~1–1.7s each). At the current scale — **3256 gh-issue sessions** (massive accumulation, most for long-closed issues) — that phase alone is ~50–90 min, and it runs BEFORE the open/closed filter, so it pays the cost even for closed chains.

**Fix (byte-identical, ~90min → instant for 1b):** `scan.py` only ever branches on `cost_status == "stopped"` (verified: `first_cost_stopped_session`/`any_session_cost_stopped`, lines ~254/290); every other value ('ok'/'warn'/'escalated'/'unknown') is treated identically as "no signal." So the 3256 per-session calls are replaceable by ONE bulk `ncl cost-cap stopped --json` (returns `data.stopped[]`, the LIVE currently-stopped set, in ~1.5s). Stamp `cost_status="stopped"` iff the session id is in that set, else `"unknown"`. Produces identical scan.py classification.

Patch applied this tick: copied pull-universe.sh, replaced the `cost_status()` subprocess call with a lookup against a `STOPPED_SET_JSON` env built from the bulk call. Full run then completed in **46 min** (dominated by the per-chain step-4b loop over 1402 chains, ~1.4s/chain — the next bottleneck to batch). Copy: `/workspace/agent/reports/pull-universe-fast.sh`, runner `/workspace/agent/reports/run-fast.sh`.

**Also observed (worth operator attention):** global `ncl sessions list` over-pulls chains from OTHER agent groups (nanoclaw, slang-vscode-extension, slang-torch) and malformed/composed thread keys, inflating must_nudge with rows the slang supervisor can't route. `reports/issue-chain-tracker.md` is 7.5MB / 218 ticks (append-only, unbounded).

**Recommendation:** land the bulk-`stopped` optimization into `container/skills/supervise-issues/scripts/pull-universe.sh` step 1b upstream; consider scoping the scan to owned coworker groups; batch step-4b's per-chain outbound/comment fetch.
