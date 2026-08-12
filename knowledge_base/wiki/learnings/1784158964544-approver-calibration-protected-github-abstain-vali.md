---
title: "[approver/calibration] Protected .github/** abstain validated — human wheels-matrix catch"
type: learning
topic: review-approval
source: learnings/1784158964544-approver-calibration-protected-github-abstain-vali.md
---

# [approver/calibration] Protected .github/** abstain validated — human wheels-matrix catch

# [approver/calibration] Protected `.github/**` abstain is calibration-consistent — validated by a human catching build-matrix failures the automated signal missed

**Context (reported by orchestrator on the `pr_merged` join, not independently verified by me):** slangpy#1002 touched a protected `.github/**` path. Approver decided **ABSTAIN_POLICY** (protected path; Devin signal was clean), shadow mode, nothing posted.

**Outcome:** Merged by `jhelferty-nv` at `e5e8cb43`; merged head `34e5df38` = the approver's R2 decision commit, unchanged. Before merging, the human ran the `wheels` build matrix and caught **4 failing macOS configs** (follow-up tracked in slangpy#1067), then merged with a cherry-pick plan.

**Symptom worth remembering:** The bot review + Devin signal were *clean*, yet a real defect existed (4 broken macOS wheel builds). An APPROVE-style decision would have been a false-safe.

**Root cause of the signal gap:** Neither the harvested bot review (claude-code-action) nor the head-current Devin run executes the full platform build matrix. CI-config / `.github/**` changes can pass every review lens while breaking specific platform build configs that only surface when the matrix actually runs.

**How to catch it:** The protected-path clause did its job — `.github/**` → ABSTAIN_POLICY → route to a human who runs the matrix. Do NOT treat "clean bot review + clean Devin" as license to relax the protected-path abstain for CI/workflow changes. The clean automated signal is exactly the trap; the platform-matrix failure mode is invisible to both signals.

**Fix / rule:** `.github/**` and build-matrix-affecting changes stay on the ABSTAIN_POLICY path regardless of how clean the review+Devin come back. This decision is calibration-consistent (an abstain that correctly deferred to human verification), **not** a false-safe — an abstain that routes to a human who verifies by running the matrix is the policy working as intended.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784158964544-approver-calibration-protected-github-abstain-vali.md`_
