---
title: "supervise-issues pull-universe.sh cost-cap stamping was O(all-sessions), ~80min — fixed to O(1)"
type: learning
topic: agent-ops
source: learnings/1789349178875-supervise-issues-pull-universe-sh-cost-cap-stampin.md
---

# supervise-issues pull-universe.sh cost-cap stamping was O(all-sessions), ~80min — fixed to O(1)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-14T01:26:18.875Z
---

# supervise-issues pull-universe.sh cost-cap stamping was O(all-sessions), ~80min — fixed to O(1)

**Symptom (Tick 223, 2026-09-14):** `/supervise-issues` → `scripts/pull-universe.sh` hung for 20+ min with an empty stderr and 0-byte stdout. Not a crash — the pre-fetch **cost-cap stamping** phase (step "1b") loops `ncl cost-cap status --session <id>` over **every** gh-issue session. At this install's history size that is ~3302 sessions × ~1.5 s/call ≈ **80 min**, which never completes within a tick, so the board never posts.

**Root cause:** the loop stamps ALL historical gh sessions (1460 distinct threads / 3302 sessions), but `scan.py` only ever consumes `cost_status == "stopped"` (`any_session_cost_stopped` / `first_cost_stopped_session`, `scan.py:290`). Every other value (`ok`/`warn`/`escalated`/`unknown`) is treated identically as "no signal." So 3302 per-session calls compute one bit that a single call already gives.

**Fix (durable):** replaced the per-session loop with ONE `ncl cost-cap stopped --json` call (the live currently-blocked set), marking only those session ids `stopped` and leaving the rest `unknown`. Semantically identical for scan.py; runtime dropped from ~80 min to seconds. Backup at `scripts/pull-universe.sh.bak.t223`.

**How to run the scan correctly:** `pull-universe.sh` produces the universe payload `{now, sessions, chains, state}` — it is NOT the classified board. You must pipe it into `scan.py` to get `{now, rows, summary, state}`. The skill's canonical form is `bash scripts/pull-universe.sh --state <state> | python3 scripts/scan.py > out.json`. Splitting the two (cache pull-universe to disk, then run scan.py separately) is fine and lets you re-classify without re-fetching.

**General lesson:** any supervisor step that is O(all historical sessions) will silently outgrow the tick budget as session history accumulates. Prefer a single aggregate query (`ncl cost-cap stopped`) over a per-session fan-out whenever the consumer only needs the aggregate.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789349178875-supervise-issues-pull-universe-sh-cost-cap-stampin.md`_
