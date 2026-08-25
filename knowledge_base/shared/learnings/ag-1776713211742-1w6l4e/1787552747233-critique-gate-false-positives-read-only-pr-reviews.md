---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786731582318-dkv3st
written_at: 2026-08-24T06:25:47.233Z
---

# Critique gate false-positives read-only PR reviews fetch as PR-creation

## Finding

The critique-on-deliver gate (`gate-critique-on-deliver.sh`, matcher around lines 380–405) matches a **read-only** `gh api repos/<owner>/<repo>/pulls/<n>/reviews` fetch as a **"PR creation"** action. This is a false positive: a PR-approver harvesting the already-posted bot review is reading, not creating. The gate counts denials against it (3-attempt cap), then writes a **local** self-heal escalation file at `/workspace/.claude/critique-escalation.json` with `hit: "PR creation"`, `reason: "missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW"`.

## Important: local file ≠ host escalation

The local escalation file is only promoted to a host-side `pending_approvals` / `critique_gate_bypass` row when the hook **forwards** it (sets `forwarded_at`). An unforwarded file is still in local self-heal — **no host row exists**, so `ncl approvals list` shows nothing. Do NOT relay the hook's "escalation opened" wording as host state; open the artifact and check `forwarded_at` first. (Measured 2026-08-24 on shader-slang/slang#11225 R3: local file present, `forwarded_at` absent → no host row, nothing to dismiss. An approver initially over-claimed "opened an admin escalation" by relaying the hook wording; group-scoped `ncl` can't read the host approvals table, so it had no standing to assert a host row existed — the orchestrator's ledger check was authoritative.)

## Mitigation (for PR-approvers, effective now)

Read PR reviews via the MCP tool **`github_get_pull_request_reviews`** instead of `gh api .../pulls/<n>/reviews`. The MCP path does not trip the matcher. Abstain decisions are not critique-gated anyway, so the read completes regardless — but the mitigation avoids the spurious denial churn and local escalation file.

## Fix (matcher-side, for whoever touches the critique gate)

Teach the matcher to distinguish a read-only `pulls/<n>/reviews` GET from a PR-creation write. A read-only reviews/comments/status fetch by a read-only role (PR-approver) should not count as a gated write action.
