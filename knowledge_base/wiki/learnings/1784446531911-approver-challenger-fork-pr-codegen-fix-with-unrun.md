---
title: "[approver/challenger] fork-PR codegen fix with unrun validating test => OPEN_GAP not WOULD_APPROVE"
type: learning
topic: review-approval
source: learnings/1784446531911-approver-challenger-fork-pr-codegen-fix-with-unrun.md
---

# [approver/challenger] fork-PR codegen fix with unrun validating test => OPEN_GAP not WOULD_APPROVE

**Symptom:** slang#12142 "[Metal] Fix RayQuery TriangleFrontFace emission" (ramang-unity, fork, CONTRIBUTOR). Primary github-actions review = Clean, Devin exit0 no findings, all 6 clauses pass under mounted relaxed policy, 3🟡 gaps all clear as advisory. Everything says WOULD_APPROVE. Decided **ABSTAIN_POLICY (OPEN_GAP)** instead.

**Root cause / the discriminator:** the change is a Metal-*codegen* fix (changes emitted MSL accessor names) whose ONLY validating test is a new `-target metal` FileCheck leg — and that test **never executed**. External-fork PRs on shader-slang/slang have their `CI` workflow gated: on the pinned head the `CI` run is `conclusion=action_required` with **0 jobs** (never approved to run). The green *combined status* covers only `license/cla` + `CodeRabbit` + `SlangPy Tests`(trigger) — NOT slang's build/test matrix. So the emission the PR fixes has ZERO executed validation, and the approver container has no local Metal run path (no slangc build, no GPU/macOS). Correct-by-inspection ≠ validated.

**How to catch it:** For any fork/external-contributor PR, do NOT trust the green combined status. Pull the Actions workflow runs for the head (`/repos/{repo}/actions/runs?head_sha=<sha>`) and check the **`CI`** run's conclusion + job count. `action_required` + `total CI jobs: 0` = the matrix never ran. Cross-check the review's claim ("test X validates the fix on Linux") against whether that test's CI leg actually executed. When the change is codegen/emission and its validating test is unexecuted AND you can't run the target locally → the correct maintainer action is "run CI, then approve", i.e. **OPEN_GAP**, never round up.

**Fix:** Codegen change + unrun validating test + no local execution path ⇒ ABSTAIN_POLICY/OPEN_GAP. Shadow mode never rounds up on unexecuted codegen. Sibling precedents: PR 12138 (ext-fork CI maintainer-gated + unrun test → ABSTAIN), PR 800 slang-rhi (backend test masked out / never executed → ABSTAIN). The relaxed mounted policy's `require_ci_green:false` deliberately lets these reach the challenger instead of Step-1 failing — so the CI-never-ran fact surfaces as an OPEN_GAP in the challenger, exactly where a human-must-look judgment belongs.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784446531911-approver-challenger-fork-pr-codegen-fix-with-unrun.md`_
