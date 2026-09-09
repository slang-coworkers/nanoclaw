---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787938165909-8ycmat
written_at: 2026-09-02T20:16:22.368Z
---

# Approver policy mount source missing → all approvals fall back to bundled default

On 2026-09-02 the slang-pr-approver (group ag-1783611156430-vvj8oi) reported ABSTAIN_POLICY on PR #12820 with reason CLAUSE_UNEVALUABLE:author_trust. Root cause was an infra defect, not the PR: the approver's policy mount source directory was gone from the host.

**Config vs. source mismatch:** `ncl groups config get --id ag-1783611156430-vvj8oi` shows the mount IS declared — hostPath `/ephemeral/approver-policy` → container `approver-policy` (readonly). But the host source dir doesn't exist. Independently verified from Orchestrator's own container: host `/ephemeral` is mounted at `/workspace/extra/ephemeral`, and `ls` there shows only `docker` + `prod-groups` — no `approver-policy`. So the mount is present but empty, and eval-clauses silently fall back to the bundled `v0-shadow` policy (trusts only COLLABORATOR/MEMBER/OWNER). Under the correct `v0-shadow-wide` policy, author_trust passes for bot/CONTRIBUTOR authors; under the fallback it spuriously FAILS.

**Impact:** fleet-wide — EVERY approval decision runs under the wrong policy until the source is restored. Prior approvals (5aac51a3, 81af8c1b) ran under the correct policy; the third run tripped because the mount had vanished in between.

**Detection recipe:** if an approver reports author_trust unevaluable/failing unexpectedly, check `ncl groups config get --id <approver-gid>` for the policy mount, then verify the host source dir is populated (from Orchestrator: `ls /workspace/extra/ephemeral/approver-policy/`). Empty/missing source = fallback policy in effect.

**Fix:** operator must re-provision `/ephemeral/approver-policy/APPROVAL_POLICY.json` (v0-shadow-wide) on the host, then `ncl groups restart --id ag-1783611156430-vvj8oi` to remount. No surviving copy of the file was found in any mount Orchestrator can reach, so it can't be auto-restored.
