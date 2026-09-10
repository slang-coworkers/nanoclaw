---
name: project_cost_decision_handler_missing_fleet
description: "INFRA 2026-08-21: host has NO registered handler for approval action=cost_decision, so cost-cap escalations are inert fleet-wide — admin approve/reject is a no-op, sessions burn past cap and never halt. 4+ pending across 3 groups, worst 2× cap. Escalated to operator; I cannot install a handler."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# `cost_decision` approval handler missing — cost caps unenforced fleet-wide

**Discovered 2026-08-21 ~02:31** via system notification: *"Your cost_decision was approved, but no
handler is installed to apply it."* Not my session's decision — investigation showed **systemic**.

## What's happening

A session hitting its Tier-2 cost cap raises a `cost_decision` approval (dashboard card, approve/reject/
reject-with-reason). The admin can act on the card, **but the host has no registered handler for
`action=cost_decision`**, so the decision is never applied: the session neither halts nor gets its cap
raised. **The cap is not stopping anything** — sessions run past it and the approve/reject is a no-op.
Contrast the handlers that DO exist: `install_packages`, `add_mcp_server`, `onecli_credential`.

## Measured state (via `ncl approvals list` / `ncl sessions get`)

4 pending `cost_decision` across 3 groups + 1 approved-but-unapplied (the notification), **all still
`running`, last_active within ~2 min, all already over cap:**

| session | group | thread | spent | cap |
|---|---|---|---|---|
| …lrjvuo | slang-triager | slang#12661 | **$71.05** | $34.84 (2×) |
| …hj68zl | slang-triager | slang#12667 | $48.80 | $45.01 |
| …royeq4 | slang-fixer | slang#12661 | $46.77 | $32.63 |
| …9fon2n | orchestrator | (none) | $28.77 | $20.00 |
| …t41g0t | slang-fixer | slang#12668 | $34.76 | $24.96 (approved, unapplied) |

⭐ **Two sessions on slang#12661 (royeq4 fixer + lrjvuo triager) — likely the same issue chain burning
in parallel.** Worth the operator checking for a duplicate/loop.

## Why escalated, not fixed (`send_message` to orchestrator-dashboard, msg 109, 2026-08-21)

- **No agent path to apply it:** `ncl approvals` exposes only `list`/`get` — no apply/resolve verb. The
  handler is host-side (`requestApproval()` handler registry) and I cannot register one.
- ⛔ **Did NOT raise caps via `ncl cost-cap set` as a stopgap** — it would not resolve the stuck
  approvals, the sessions are already over-cap and running regardless, and it would **mask the handler
  bug**. Per OPS: never let a cost/enforcement path silently no-op; alert the operator with the failing
  step + exact figures. This is that.

⚠️ **Open question flagged to operator:** how long has `cost_decision` been no-op'ing? If the handler
went missing silently, cost-cap enforcement may have been inert for some time — a capability-negative
with no failure signature ([[feedback_published_negative_env_claims_need_rederivation]]): the cap
"exists" in `ncl cost-cap get` but does not act.

RESUME: operator registers/repairs the handler, or asks for per-session transcripts/spend detail.
Related: [[project_triager_clone_nine_concurrent_writers]] (same slang-triager group, concurrent-session
load is also what runs up these bills).
