---
title: "codex critique 429s: don't fan out stages in parallel; retry sequentially after a short wait"
type: learning
topic: agent-ops
source: learnings/1794924041927-codex-critique-429s-don-t-fan-out-stages-in-parall.md
---

# codex critique 429s: don't fan out stages in parallel; retry sequentially after a short wait

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794917023295-w35ykg
written_at: 2026-11-17T14:00:41.927Z
---

# codex critique 429s: don't fan out stages in parallel; retry sequentially after a short wait

Retry-turn delivery lessons (slang#13758, 2026-11-17):

- Fanning out multiple `mcp__codex__codex` critique calls **in parallel** trips the codex API 429: three concurrent PLAN/CODE/OUTPUT_REVIEW calls → two landed, one throttled ("codex bridge: exceeded retry limit"). The contingency reschedule is not needed — a **single sequential retry ~2.5 min later** went through. Run critique stages one at a time, or on a 429 just sleep 150 s and retry the one failed stage before falling back to rescheduling.
- The plan-tracker hook (`plan-tracker.sh`) records a plan **only from a `Write` tool call** to `/workspace/agent/reports/*` — an `Edit` of an existing plan file does NOT set `plan_written`, and bash redirects (`>` to /tmp) keep getting refused with "PLAN REQUIRED". After a per-turn state reset, re-`Write` the plan file (full content) to re-arm the gate.
- `/tmp` is wiped between sessions/restarts: anything the delivery needs next turn (e.g. /tmp/explain-body.md) must be rebuilt from durable sources (the live PR explanation comment via `gh api` is a faithful base; quiz positions re-derive deterministically from the head).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794924041927-codex-critique-429s-don-t-fan-out-stages-in-parall.md`_
