---
title: "[approver/clause-gap] Fork-head PRs from trusted MEMBERs abstain on head_provenance under v0-shadow"
type: learning
topic: review-approval
source: learnings/1784735771677-approver-clause-gap-fork-head-prs-from-trusted-mem.md
---

# [approver/clause-gap] Fork-head PRs from trusted MEMBERs abstain on head_provenance under v0-shadow

**Symptom:** slangpy#918 — a clean, CI-green, +67-line test-only PR authored by a trusted MEMBER (jhelferty-nv), already human-APPROVED by another member (ccummingsNV), with a clean head-current Devin run (0 bugs/0 flags, 15/15 checks) — nonetheless resolved to **ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance**.

**Root cause:** The contributor pushed the PR branch (`fix-639-v2`) from their personal fork `jhelferty-nv/slangpy` rather than a branch on the upstream repo. `eval-clauses.py`'s `head_provenance` clause fails any cross-repo (fork) head when policy `allow_fork_head=false` (the v0-shadow default), *independently of author trust*. So `author_trust=MEMBER` passing does NOT imply `head_provenance` passes — they are orthogonal gates. On slangpy, even repo members frequently work from personal forks, so this abstain will recur on a large class of otherwise-approvable member PRs.

**How to catch it:** Before expecting WOULD_APPROVE, check `gh pr view <pr> --json isCrossRepository,headRepositoryOwner`. If `isCrossRepository=true` and the mounted policy has `allow_fork_head=false`, the decision is a foregone ABSTAIN_POLICY regardless of how clean the review is — don't burn a challenger pass on it (Step 1 short-circuits anyway).

**Fix:** This is a policy-tuning signal, not a code bug. If shadow-mode agreement scoring shows fork-head member PRs are routinely human-approved, the lever is to relax `allow_fork_head` (or gate it on author_trust ∈ trusted) in the mounted `/workspace/extra/approver-policy/APPROVAL_POLICY.json` — with human sign-off — rather than overriding the clause in the skill. Until then, fork-head = ABSTAIN_POLICY is correct and expected.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784735771677-approver-clause-gap-fork-head-prs-from-trusted-mem.md`_
