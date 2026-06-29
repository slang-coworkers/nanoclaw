---
name: Main can't approve install_packages/add_mcp_server — operator does
description: self-mod approvals (install_packages, add_mcp_server) route to a HUMAN admin/owner (dashboard-admin) via pickApprover, NOT to Main; Main can request + list approvals (read-only) but has no approve path
type: feedback
originSessionId: 79b38293-7648-4320-8e2b-0c2a196cea57
---
**Rule:** When a coworker calls `install_packages` (or `add_mcp_server`), the approval card is delivered to the **human operator** (`dashboard-admin`), resolved via `pickApprover` from `user_roles` (scoped admins → global admins → owners — all *human* users). **Main is an agent, not a user-role holder, so Main is NOT the approver.** `ncl approvals` is **read-only** (`list`/`get` only — no approve verb), and there is no approve MCP tool. So Main **cannot** tap-approve a coworker's self-mod request.

**Why:** Caught 2026-06-24 — I pre-cleared a slangpy-fixer `install_packages` (python3-dev) with "ping me, I'll fast-track the approval," then found via `ncl approvals list` that the card routed to `dashboard-admin` (channel_type=dashboard) with no approve path for me. The fixer was waiting on me; I can't act. Verified: appr-…09zkh1 status=pending, platform_id=dashboard-admin.

**How to apply:** Don't promise to "approve / fast-track" a coworker's `install_packages`/`add_mcp_server`. The correct framing: "it routes to the operator's dashboard for approval — wait for their tap, not mine." I CAN: (a) confirm it's pending + routed via `ncl approvals list`, (b) surface/nudge the operator if they're inactive (push, or note it), (c) tell the coworker their resume-prep is sound for the post-approval restart. The actual Approve tap is the human operator's only.
