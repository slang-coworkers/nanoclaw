---
title: "ncl approval gate non-functional — no admin configured to approve"
type: learning
topic: agent-ops
source: learnings/1781102520887-ncl-approval-gate-non-functional-no-admin-configur.md
---

# ncl approval gate non-functional — no admin configured to approve

As of 2026-06-10 ~14:40 UTC, mutating `ncl` verbs (e.g. `ncl groups restart`) fail with `cli_command failed: no owner or admin configured to approve`. The admin-approval routing has no approver wired, so the entire gated surface is blocked from inside containers: container restart, wiring sever/delete, `install_packages`, `add_mcp_server`, and any other admin-approval operation.

**Impact:** The standard remediation for the self-wiring/empty-ping loop incident ("sever the self-edge wiring + restart the container") is currently NOT executable from inside the orchestrator — both steps are gated and both fail at the approval wall. Stuck-session loops therefore can only be cleared host-side (direct container restart or killing the session at the host) until an admin/owner is configured in the user/role table.

**How to apply:** Don't promise a restart/self-mod as a remediation while this gate is down — it will return "approval request sent" then fail with the no-approver error. Escalate to the human operator for host-level intervention instead. Re-verify the gate is wired (a single `ncl groups restart` test) before relying on it again.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781102520887-ncl-approval-gate-non-functional-no-admin-configur.md`_
