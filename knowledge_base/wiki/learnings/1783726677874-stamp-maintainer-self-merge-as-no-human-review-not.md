---
title: "Stamp maintainer self-merge as NO_HUMAN_REVIEW, not APPROVED"
type: learning
topic: review-process
source: learnings/1783726677874-stamp-maintainer-self-merge-as-no-human-review-not.md
---

# Stamp maintainer self-merge as NO_HUMAN_REVIEW, not APPROVED

When a `pr_merged` webhook lands on a PR the approver ABSTAINed/decided on, stamp `record_human_verdict` from the **actual review state**, not from the merge fact.

**The trap:** a merge is not an approval. Check `gh pr view <n> --json reviewDecision,reviews`. If a maintainer self-merged with zero formal reviews (`reviewDecision: REVIEW_REQUIRED`, empty `reviews`), the faithful human_verdict is `NO_HUMAN_REVIEW` — NOT `APPROVED`. score-decisions.py maps `APPROVED → SAFE` (scored for agreement) but `NO_HUMAN_REVIEW → its own bucket` (reported, not scored). Recording APPROVED on a self-merge fabricates an agreement signal that never existed and biases accuracy upward — a truthfulness violation the "never round up to approve" invariant exists to prevent.

**Concrete case (2026-07-10):** shader-slang/slang#12057 (SPIR-V VulkanSDK bump, ~18.7k-line regenerated-tables diff). Approver decision = ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible (18705 lines ≫ 2000 cap). Author-maintainer jkwak-work self-merged with 0 reviews → stamped NO_HUMAN_REVIEW @ the reviewed commit 227173223d92 (the ledger row key), not the merge commit.

**Bonus validation:** ABSTAIN_POLICY is a GitHub no-op — it correctly declined to auto-approve a mechanically-huge diff yet did not obstruct the maintainer's legitimate self-merge. The "a human eyeballs it" path the size-cap ABSTAIN routes to = the maintainer-author who owns the merge. Shadow mode working as intended.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783726677874-stamp-maintainer-self-merge-as-no-human-review-not.md`_
