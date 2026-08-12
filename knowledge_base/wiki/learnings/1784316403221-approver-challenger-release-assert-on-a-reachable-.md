---
title: "[approver/challenger] RELEASE_ASSERT on a reachable multi-artifact count is a RED_BUG, not a valid impossible-shape guard"
type: learning
topic: review-approval
source: learnings/1784316403221-approver-challenger-release-assert-on-a-reachable-.md
---

# [approver/challenger] RELEASE_ASSERT on a reachable multi-artifact count is a RED_BUG, not a valid impossible-shape guard

**Symptom:** A new output-path validator (`_validateSeparateDebugInfoOutputPaths`, slang#12147) used `SLANG_RELEASE_ASSERT(debugArtifactCount == 1)` for the "2+ artifacts claim one explicit sidecar path" case, while its sibling validator `_validateCoverageManifestOutputPaths` handled the SAME `>1` condition with a graceful diagnostic (`CoverageManifestOutputMultipleArtifacts`). The assert aborts slangc (RELEASE_ASSERT fires in release builds) on valid CLI input.

**Root cause:** The codebase's own guidance ("assert impossible shapes; handle valid input") is only correct if the shape is genuinely impossible. Here `debugArtifactCount >= 2` is REACHABLE: `slangc -target spirv -g2 -emit-spirv-directly -separate-debug-info -separate-debug-info-output out.dbg.spv -entry mainA -stage compute -entry mainB -stage compute`. In non-whole-program mode each entry point is a SEPARATE artifact (`m_entryPointResults` array; `_createEntryPointResult` builds one artifact per entry-point index — slang-target-program.cpp:57-95), and each SPIR-V artifact attaches its own separate-dbg child (slang-emit.cpp:3451-3468 `artifact->addAssociated(dbgArtifact)`). So N entry points ⇒ debugArtifactCount==N.

**How to catch it:** When a PR adds a validator/guard that MIRRORS an existing sibling (coverage vs debug here), DIFF the two for divergence — if one diagnoses a condition the other asserts, the assert is the suspect. Then prove reachability at the PRODUCER: does the counted thing (artifact, entry point, target) come from a per-item array/loop that can exceed 1 on valid input? Per-entry-point / multi-target compiles are the classic way "count==1" assumptions break. Bonus tell: the bug is CI-invisible when the new tests only cover single-entry-point / whole-program (as here) — green CI does not clear an assert on an untested input shape.

**Fix (author-side):** replace the RELEASE_ASSERT with the same graceful diagnostic the sibling validator uses for `>1`. Decision: BLOCK / RED_BUG. This 🔴 was found independently by source trace AND named by the production github-actions[bot] review at the exact file:line — two-way confirmation.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784316403221-approver-challenger-release-assert-on-a-reachable-.md`_
