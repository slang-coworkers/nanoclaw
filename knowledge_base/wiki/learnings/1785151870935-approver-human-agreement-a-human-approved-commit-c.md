---
title: "[approver/human-agreement] A human APPROVED commit can predate a later head-current bot finding — record the join but don't round the shadow decision up"
type: learning
topic: review-approval
source: learnings/1785151870935-approver-human-agreement-a-human-approved-commit-c.md
---

# [approver/human-agreement] A human APPROVED commit can predate a later head-current bot finding — record the join but don't round the shadow decision up

**Context:** slangpy#1075 R3 @ e65086. Fast-moving PR: author addressed the two maintainer OPEN_GAPs (removed the slang-rhi bump; clarified the `device->wait()` blit-copy backpressure semantics), maintainer tdavidovicNV **APPROVED** — and then, ~3 minutes later, CodeRabbit posted a formal review at the exact same head flagging a 🟠 Major batch-boundary off-by-one on the changed lines. Orchestrator relayed the approval as "likely clears the challenger."

**Symptom / trap:** Strong pull to flip the shadow decision to approve because (a) a real human maintainer APPROVED and (b) the prior blocking gaps were genuinely resolved. But approve-timing matters: `reviewDecision=APPROVED` and a bare `state=APPROVED` don't tell you WHICH signals the human had seen. Pull `submittedAt` for the approval AND for every bot review, and compare. Here the approval (11:18:47Z) **predated** CodeRabbit's Major finding (11:21:24Z) — the human never weighed the off-by-one. Rounding up to "APPROVE because a human did" would (1) violate the never-round-up invariant, (2) corrupt the accuracy join (the approval is the *outcome I'm measured against*, not an input to my decision), and (3) endorse a gap no human had actually judged.

**Correct handling:**
1. The human approval is recorded via `record_human_verdict(APPROVED)` for the decision commit — that's the join for calibration. It is NEVER an input that flips the independent shadow decision. (Skill invariant: "Decisions are joined against human outcomes; accuracy is measured — never round up to approve.")
2. Judge the head-current bot finding on its own merits in the challenger. CodeRabbit's "🟠 Major functional correctness" off-by-one was verified-real but LOW severity: the batching `if (i && i % BATCH_SIZE == 0)` is PRE-EXISTING (the PR only added `device->wait()` inside/after it); first batch being 33 not 32 yields correct output and still bounds the heap; the "empty encoder submit" is a harmless no-op and also pre-existing. Verified-real-but-low-severity + reachable + a concrete requested fix ⇒ OPEN_GAP (ABSTAIN), not a verified 🔴 crash (not BLOCK), and never rounded up despite the human approve.

**Two more mechanics this session reinforced:**
- **Merge-commit head:** when the synchronize is a "Merge branch 'main'" commit, `compare(prior_head...new_head)` shows dozens of intervening main files (wheels.yml, changelog, version bumps) — do NOT classify off that. `gh pr diff` (merge-base…head) and `eval-clauses.py`'s `no_protected_paths` both correctly reduce to the PR's OWN net footprint (here still just `texture_loader.cpp` +2/−1). If the net functional diff is byte-identical to a revision Devin already reviewed, fold it in — no fresh Devin needed.
- **Tier can change across revisions:** early heads were Devin-only (harvest exit 20, production claude review skipped); once CodeRabbit posted a formal review at the settled head, harvest flipped to exit 0 (CodeRabbit fallback tier). Re-harvest every revision — don't assume the tier from a prior head.

**How to catch it next time:** on any `github.pr_review` APPROVED join, always fetch `submittedAt` for the approval and diff it against the timestamps of every bot/reviewer finding at that head. An approval that predates a later finding did not weigh it — record the join, keep your independent abstain, and say so explicitly in the decision.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785151870935-approver-human-agreement-a-human-approved-commit-c.md`_
