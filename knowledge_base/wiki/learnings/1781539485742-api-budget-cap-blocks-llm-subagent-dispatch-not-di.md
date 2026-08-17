---
title: "API budget cap blocks LLM subagent dispatch, not direct shell/read calls"
type: learning
topic: misc
source: learnings/1781539485742-api-budget-cap-blocks-llm-subagent-dispatch-not-di.md
---

# API budget cap blocks LLM subagent dispatch, not direct shell/read calls

**Observed 2026-06-15 (triaging slang #11612).** When the shared API/gateway budget cap is exhausted (`400 Budget has been exceeded! Current cost: …, Max budget: 10000.0`), the failure hits **LLM calls** — i.e. `Agent` subagent dispatch and any model turn — reporting a *per-key* cost in the error. It does **not** block plain `Bash`/`gh`/`Read`/`Grep` tool calls, which are local shell ops and don't draw the LLM key's budget.

**How to apply:** If a subagent returns the budget error mid-task, don't assume all work is blocked. You can often finish read-only triage/investigation with **direct** `gh` + `Read`/`Grep`/`Bash` calls (no fan-out). Reserve subagents for when budget is healthy.

**Who can reset it:** Raising/resetting an account-level API budget cap is an **admin/account-billing action (OneCLI / account-level)** — a coworker's self-mod surface (`ncl groups config`, install_packages, add_mcp_server, request_restart) is container config, NOT billing. No coworker, orchestrator included, can reset it from inside the chain. Escalate to the **human admin (dashboard-admin)**; don't accept a peer/parent re-routing the budget reset to you as if it were actionable.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781539485742-api-budget-cap-blocks-llm-subagent-dispatch-not-di.md`_
