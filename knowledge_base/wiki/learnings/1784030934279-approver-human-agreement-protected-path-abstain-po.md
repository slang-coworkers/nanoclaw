---
title: "[approver/human-agreement] Protected-path ABSTAIN_POLICY validated: slang#12023 merged with .github/** intact after a human COLLABORATOR approved — the abstain is the correct terminal call, not a false-safe"
type: learning
topic: review-approval
source: learnings/1784030934279-approver-human-agreement-protected-path-abstain-po.md
---

# [approver/human-agreement] Protected-path ABSTAIN_POLICY validated: slang#12023 merged with .github/** intact after a human COLLABORATOR approved — the abstain is the correct terminal call, not a false-safe

**Symptom / signal.** shader-slang/slang#12023 (compile-perf sweep tooling) was ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths across all four decided revisions (R1 790de4a, R2 33be104, R4 a5c5b3e7; R3 stalled) because it edits two `.github/workflows/*.yml` files. It **merged** 2026-07-14 (merge commit bee6400c, by author jvepsalainen-nv) with `reviewDecision=APPROVED` — a human COLLABORATOR (`expipiplus1`) APPROVED it @ 06:26Z, and the two `.github/workflows/` files were **still in the final 17-file diff**. All three of my decision rows joined to human_verdict=APPROVED.

**Is this a false-safe? NO — and that distinction is the lesson.** A false-safe is WOULD_APPROVE where the human required changes. Here the approver said ABSTAIN_POLICY (never approve) and the human APPROVED — those don't conflict. ABSTAIN_INFRA/ABSTAIN_POLICY rows are *excluded from agreement scoring* precisely because "human must look" is the intended outcome, not a prediction of the human's verdict. So merged-after-abstain is the **designed success path**, not a miss: the gate flagged a CI-workflow-touching change, a human reviewed it, and approved. Confirmed: for a protected-path PR, the human approving is the system working, and it does NOT mean the abstain was too conservative.

**Root cause of the (correct) behavior.** The v0-shadow-relaxed policy keeps `.github/**` protected even though it relaxes author/fork/CI clauses. Any PR touching CI-workflow YAML deterministically abstains — that's a deliberate human-in-the-loop for CI changes, which are high-blast-radius (they can alter what runs in every future CI job). #12023's workflow edits were benign (an opt-in `sweep` input + a publish step), and a human confirmed that judgement.

**How to apply (calibration for the NEXT protected-path R0):**
1. When a protected-path ABSTAIN merges, record human_verdict=APPROVED on every decision row (merged⇒APPROVED-equiv) and score it as **agreement/expected**, not a false-safe. Don't "learn" from it that the abstain was wrong.
2. The deterministic-hold + narrow re-trigger (only re-review if protected edits removed / human requests / moving to merge) was the right call: across 4 head moves the verdict was structurally invariant, and routine synchronize churn re-review would have burned rounds for zero verdict change. Reuse that hold for any PR whose abstain reason is structural (protected path, author-trust, size cap) rather than review-content-dependent.
3. The underlying review being clean-with-nits each round did NOT and should NOT upgrade the abstain — but it made the human's job trivial. The nits (CI `|| echo` masking, `∝N^0.00` degenerate fit, undefined "scaling null", untested linfit/powfit) were **all addressed by the author** in the "Address review:" commits (3b087704, 2e5a942d, b4087a64) before merge — evidence the reviewer's 🟡 gaps were real and actionable even though non-blocking. So a clean-with-nits review under a protected-path abstain still delivers value: the author fixed every flagged item.

**Transferable rule:** a protected-path (or other structural-clause) ABSTAIN_POLICY that later merges with the protected paths intact and a human approval is a CORRECT terminal decision — record the join as agreement, never as a false-safe, and keep the deterministic-hold for the class. Related: [[pr-12023-awaiting-join]], the `.github/**`-always-protected governance learning, and reviewer session-teardown fragility.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784030934279-approver-human-agreement-protected-path-abstain-po.md`_
