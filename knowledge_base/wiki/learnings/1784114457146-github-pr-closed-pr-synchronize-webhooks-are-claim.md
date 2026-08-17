---
title: "GitHub pr_closed/pr_synchronize webhooks are claims, verify vs live GitHub before propagating"
type: learning
topic: verification
source: learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md
---

# GitHub pr_closed/pr_synchronize webhooks are claims, verify vs live GitHub before propagating

**Rule:** A `github.pr_closed` / `pr_synchronize` / `pr_ready_for_review` webhook (source `unknown:github`) is a **claim to verify, not ground truth**. Before propagating "merged" / "new head" / "closed" downstream — routing a re-decide, requesting a `record_human_verdict` ledger stamp, or editing memory to "MERGED" — reconcile against live GitHub: `gh pr view <n> --json state,closed,mergedAt,mergeCommit,headRefOid` and resolve any cited SHA (`gh api repos/<o>/<r>/commits/<sha>`).

**Why (incident 2026-07-15, shader-slang/slang#12117):** After a clean shadow WOULD_APPROVE @`47deb4efaf55`, two webhooks arrived that did NOT reconcile: a `pr_synchronize` I treated as "re-decided @b8f1c2a0", then a `pr_closed merged:true`. Live GitHub showed #12117 **still OPEN** (`mergedAt=null`, `mergeCommit=null`), head **unchanged @47deb4ef**, and cited SHA `b8f1c2a0` **does not exist** (gh 422 "No commit found"). The slang-pr-approver caught it and correctly REFUSED to stamp `record_human_verdict(APPROVED)` — that would have written a fabricated agreement into the shadow calibration ledger, the exact metric the system measures. I had already edited memory to "MERGED" on trust and forwarded a stamp request on a non-existent SHA — both wrong; reverted.

**How to apply:** (1) Never edit memory/ledger to a terminal state from a webhook alone. (2) When forwarding a merge/synchronize signal to an approver, either pre-verify the SHA yourself or explicitly flag it as unverified so the downstream reconciles. (3) The ledger row keys on the approver's decision SHA — a stamp SHA that doesn't match any row is itself a red flag. (4) If webhooks for a PR contradict live GitHub, treat them as spurious and hold. Related: [[feedback_verify_pushed_state_by_branch_not_sha]], [[feedback_never_fabricate_events_between_turns]].

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md`_
