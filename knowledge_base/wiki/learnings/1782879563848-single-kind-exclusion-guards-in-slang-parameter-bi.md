---
title: "Single-kind exclusion guards in slang-parameter-binding are correct-but-fragile; reviewers reliably ask for a shared predicate"
type: learning
topic: review-process
source: learnings/1782879563848-single-kind-exclusion-guards-in-slang-parameter-bi.md
---

# Single-kind exclusion guards in slang-parameter-binding are correct-but-fragile; reviewers reliably ask for a shared predicate

PR #11871 (fix #11860): `vk::input_attachment_index` falsely reserved descriptor set 0 (regression from #11712). `InputAttachmentIndex` lowers to `OpDecorateInputAttachmentIndex` only and is NOT a descriptor set, but its `semanticInfo.space` is a hardcoded placeholder `0`. Two independent consumers in `source/slang/slang-parameter-binding.cpp` treated placeholder-0 as an occupied set, so `-bindless-space-index 0` reported unavailable (E39012 x2) and bumped the bindless heap to set 1.

The fix = 2 hunks (both load-bearing, ablation-verified): (1) guard `markSpaceUsed(...)` in `addExplicitParameterBinding`'s else-branch with `if (kind != InputAttachmentIndex)`; (2) `case InputAttachmentIndex: return false;` in `doesEntryPointParameterResourceNeedDefaultSpace`. This is the two-phase binding model again (Phase 1 reserve-explicit vs Phase 2 auto-allocate/default-space) — the fix correctly sits in the binding layer.

**Reusable reviewer pattern (Reviewer A correctness AND Reviewer C clarity independently converged on this, Medium confidence):** a single-kind `!=` exclusion guard at the `addExplicitParameterBinding` else-branch is correct ONLY because of an unstated invariant — `InputAttachmentIndex` is the only non-descriptor-space kind that reaches that branch via an explicit binding (whole-space kinds handled by the `RegisterSpace||...` branch above; VaryingInput/Output/SpecializationConstant share the placeholder-0 pattern but aren't fed to this call in practice). Both reviewers asked to either (a) state that precondition inline, or (b) extract a shared `kindOccupiesDescriptorSpace()` predicate consulted by both fix sites (one-source-of-truth). Treat single-kind exclusion guards in this file as a review flag: verify the "only-this-kind-reaches-here" invariant and ask for it to be made explicit.

**Confirmed prior pattern:** Devin (Reviewer B) again reported 0 bugs / 0 flags and its "AI Analysis" reproduced the PR body verbatim rather than verifying independently — weak signal on this file, as previously noted.

**Test-clarity flag both A+C raised:** a regression test whose header names a warning (E39012) as the symptom but only asserts the positive reflection value (`bindlessSpaceIndex: 0`) should also `CHECK-NOT` the warning code (idiom: `// CHECK-NOT: warning{{.*}}39012`, cf. gh-8937.slang / vk-binding-with-register-no-warning.slang) or note the two conditions are equivalent.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782879563848-single-kind-exclusion-guards-in-slang-parameter-bi.md`_
