---
title: "[approver/human-disagreement] Large samples/experiment PRs self-merge past the size-cap abstain — the tier_eligible cap systematically abstains on a class humans fast-track"
type: learning
topic: review-approval
source: learnings/1783918446960-approver-human-disagreement-large-samples-experime.md
---

# [approver/human-disagreement] Large samples/experiment PRs self-merge past the size-cap abstain — the tier_eligible cap systematically abstains on a class humans fast-track

**Context:** shader-slang/slangpy-samples#53 ("Add neural.slang UTracer experiment"). My R0 decision (head e5a18be) was ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible — 7414 changed lines > the 2000-line shadow cap. Outcome: the author (kaizhangNV, a CONTRIBUTOR) SELF-MERGED at head 17ba9775 (~4h later, after 8 rapid iterating pushes) with NO formal human review (reviewDecision empty; the only review on the PR was our bot's COMMENTED-state FYI). merged ⇒ APPROVED-equivalent, stamped onto the R0 row.

**Decision vs human:** ABSTAIN_POLICY vs APPROVED. This is NOT a false-safe (I did not approve). It's the expected-and-correct behavior of the size cap — "a human must look" — but it flags a CLASS pattern worth recalling at the next similar R0.

**The class signal to probe at R0 (transferable):** A brand-new, self-contained *samples/experiment* addition (all new files under `experiments/` or `examples/`, no edits to shared/core library code, authored by a repo CONTRIBUTOR/MEMBER) will almost always be large (thousands of lines: shaders + assets + data) and is routinely FAST-TRACKED / self-merged by its author in this repo, because the bar is "self-contained and plausibly runs," not production hardening. The reviewer coworker independently reached APPROVE_WITH_NITS / 0 bugs on exactly this PR. So for this class, the tier_eligible size cap is doing its job (routing to a human) but the human's answer is nearly always "ship it."

**Implication for the approver, NOT a policy override:** the size cap stays terminal — never round a 7000-line PR up to approve. But when recalling priors for a large all-new samples/experiment PR by a trusted author, expect ABSTAIN_POLICY:tier_eligible to be the terminal outcome AND expect the human to approve/self-merge quickly; the challenger never runs (short-circuited by the clause fail), so the reviewer's 0-bug read is the only quality signal that reaches a human — which makes surfacing that read on the PR (the COMMENT-state review) the highest-value action available on this class. If the shadow policy is ever tuned, "new-experiment-only, trusted author, no shared-code edits" is the candidate carve-out to discuss with a human — but that's a policy decision, not an approver call.

**Also observed (merged-code check):** the reviewer's flagged items shipped UN-addressed — training.slang was never touched R0→merge (color-augmentation label/feature mismatch at :196-231 and validation NaN-guard asymmetry at :318 both remain), and README never gained the `git lfs pull` step. Consistent with a fast self-merge that treats bot FYIs as non-blocking. Lesson: for this class, don't expect flagged nits to be resolved before merge; the value is in surfacing them for the record, not in gating on them.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783918446960-approver-human-disagreement-large-samples-experime.md`_
