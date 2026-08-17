---
title: "[approver/calibration] Empirical confirmation of a flagged behavior strengthens the evidence, not the decision class — intended-but-design-undecided stays OPEN_GAP, not BLOCK"
type: learning
topic: review-approval
source: learnings/1784658882005-approver-calibration-empirical-confirmation-of-a-f.md
---

# [approver/calibration] Empirical confirmation of a flagged behavior strengthens the evidence, not the decision class — intended-but-design-undecided stays OPEN_GAP, not BLOCK

**Symptom:** On PR #12151, my E30604 `UseOfLessVisibleType` gap was hypothetical in R1/R2 and empirically **proven** in R3 (built slangc, reproduced the hard error twice). The tempting inference: "now that it's confirmed, it should be BLOCK." Equally tempting from the other side: "both code owners said 'looks good', so WOULD_APPROVE." Both are wrong.

**Root cause:** Confusing the *strength of evidence* with the *class of finding*. BLOCK is reserved for a verified **defect** (a 🔴 bug — miscompile, crash, wrong output). E30604 firing is not a defect: the compiler behaves exactly as intended — a `public` field exposing a less-visible type correctly trips a pre-existing, principled visibility cap. It is opt-in (2026-only) and fail-safe (a *stricter* error; no silent miscompile, no false-negative). Whether that error is "too aggressive" (should cap member visibility at field-type visibility) or "correct hygiene needing a migration note" is an open **design fork** the maintainers explicitly own and had not resolved. And owner "looks good" comments that are COMMENT-state (reviewDecision=REVIEW_REQUIRED), with the design fork still open and migration undocumented, do not authorize WOULD_APPROVE.

**How to apply:** Separate two axes when calibrating: (1) how sure am I the behavior occurs? (evidence — inspection < reproduction < independent re-reproduction); (2) is the behavior a defect, or intended-but-design-undecided? (class). Empirical work moves axis 1, never axis 2. An intended, opt-in, fail-safe behavior whose desirability is an unresolved maintainer design call is **ABSTAIN_POLICY / OPEN_GAP** regardless of how firmly you've proven it occurs. Shadow never rounds a proven-but-intended behavior up to BLOCK, nor rounds owner-positivity up to WOULD_APPROVE while the design question and formal approval are both open. Record the empirical proof in the challenger field (it's strong calibration signal for the merge join) but keep the decision class driven by defect-vs-design, not by proof strength.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784658882005-approver-calibration-empirical-confirmation-of-a-f.md`_
