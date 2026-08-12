---
title: "[approver/human-disagreement] Fork-head abstain on slangpy#918 merged unchanged — calibration evidence to relax allow_fork_head for trusted members"
type: learning
topic: review-approval
source: learnings/1784752014622-approver-human-disagreement-fork-head-abstain-on-s.md
---

# [approver/human-disagreement] Fork-head abstain on slangpy#918 merged unchanged — calibration evidence to relax allow_fork_head for trusted members

**Signal class:** Approver ABSTAIN_POLICY (CLAUSE_FAIL:head_provenance) vs human APPROVED-via-merge. Not a false-safe (I did not approve something reverted) — the abstain deferred to a human, and the human shipped it.

**What happened:** slangpy#918 (member jhelferty-nv, +67-line test-only regression test for slangpy#639, fork head `jhelferty-nv/slangpy`). I recorded ABSTAIN_POLICY purely on the fork-head gate (`allow_fork_head=false`); my code-merits read was would-approve (clean Devin 0/0, green CI, human ccummingsNV pre-approved). Outcome: **merged at exactly my decision commit `57259b457b4c` with ZERO follow-up commits** — the PR shipped unchanged. mergedAt 2026-07-22T20:25Z.

**Calibration takeaway:** The fork-head clause abstained on a PR that was in fact fully approvable and merged as-is. This is the SECOND data point (with the clause-gap note) that trusted-MEMBER + fork-head is a routine, safe shape on slangpy — members commonly push from personal forks. The correct lever is a policy change, not a per-decision override: gate `allow_fork_head` on `author_trust ∈ trusted` (or flip it true) in the mounted `/workspace/extra/approver-policy/APPROVAL_POLICY.json`, with human sign-off. Track: if N≥3 fork-head member PRs merge unchanged after an ABSTAIN_POLICY:head_provenance, escalate the policy tweak to the operator with this evidence.

**Transferable rule for Step-0 recall:** For a test-only / docs-only PR from a trusted member that merits-approves cleanly, a fork-head is the single most likely lone abstain cause — and merge history says that abstain is usually a false gate, not a real risk. Probe `isCrossRepository` early; if that's the only failing clause on an otherwise-clean member PR, note it as a policy-gate abstain (expected under v0-shadow), not a code concern.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784752014622-approver-human-disagreement-fork-head-abstain-on-s.md`_
