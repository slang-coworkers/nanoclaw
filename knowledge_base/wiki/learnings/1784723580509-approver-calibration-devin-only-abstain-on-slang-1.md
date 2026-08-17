---
title: "[approver/calibration] Devin-only ABSTAIN on slang#11475 R3 later corroborated by the delayed primary production review of the SAME head — 0 correctness bugs, matching gap set"
type: learning
topic: review-approval
source: learnings/1784723580509-approver-calibration-devin-only-abstain-on-slang-1.md
---

# [approver/calibration] Devin-only ABSTAIN on slang#11475 R3 later corroborated by the delayed primary production review of the SAME head — 0 correctness bugs, matching gap set

**Context:** slang#11475 R3 (commit 9787b889e8fc). At decision time the primary production review (`github-actions[bot]`) had not yet posted for the R3 head, so I decided on the **Devin-only tier**: ABSTAIN_POLICY (OPEN_GAP), no 🔴, held on residual test/coverage gaps (passthrough member-`this`, DerefMemberExpr pointer-type, fwd_diff(member) untested, transitive ApplyForBwd).

**Agreement signal (calibration hit):** ~19 min after my decision, the production review landed against the **exact same commit** `9787b889e8fc` (diff_hash 3e5e399eb9f8, not stale). Re-harvesting it (harvest exit 0, `found:true`, `stale:false`) returned: **🟡 "no correctness bugs found — 2 test gaps, 2 clarity notes."** Five specialized reviewers (code-quality, IR-correctness, security, test-coverage, documentation) found no memory-safety/UB/IR-correctness defects, and independently verified the R3 pack refactor (`_getBackwardDiffScalarParameterType` mode mapping, the Swizzle-of-MakeValuePack peephole bounds/type guards, the eliminateDeadCode-after-specialize call) as **behavior-preserving** — the same read I (and codex) reached adversarially. Its gap set matched mine: `fwd_diff(obj.method)` untested (my G1) and the `getThisTypeForBaseFunc` originalMemberExpr-vs-memberExpr branch precedence (my G2 region).

**Takeaways:**
1. The Devin-only tier produced a verdict that the delayed primary production review independently confirmed on the identical head (no-🔴 → ABSTAIN, not BLOCK; gaps → not APPROVE). This is direct evidence the Devin-only fallback is trustworthy for the no-bug/gaps distinction when the primary review hasn't posted yet.
2. Operationalizes [[approver-challenger-miss-on-a-live-multirevision-pr-a-production]]: when a supervisor nudge or PR-activity event arrives on an already-decided head, RE-HARVEST — the primary review may have caught up to a head you decided via Devin-only, giving a retroactive agreement/disagreement check. Here it agreed. If it had flagged a 🔴 I cleared, that would have been an immediate [approver/false-safe] trigger.
3. `mergeStateStatus=BLOCKED` + `mergeable=MERGEABLE` + `reviewDecision=REVIEW_REQUIRED` = branch-protection human-review gate, NOT an approver-actionable blocker. A supervisor "ball on our side" scan misattributes this for a shadow-mode approver; the correct reply is "decision complete; awaiting human maintainer review." Related: [[approver-reviewer-debounce-live-pr-head-churn-then]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784723580509-approver-calibration-devin-only-abstain-on-slang-1.md`_
