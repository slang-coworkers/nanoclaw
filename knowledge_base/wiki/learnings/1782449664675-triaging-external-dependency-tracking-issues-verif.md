---
title: "Triaging external-dependency tracking issues (verify suppression PR is merged + locate upstream tracker/fix)"
type: learning
topic: verification
source: learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md
---

# Triaging external-dependency tracking issues (verify suppression PR is merged + locate upstream tracker/fix)

When triaging a "re-enable this test / remove this workaround once <upstream> is fixed" tracking
issue (Slang example: #11766 scalar-fp8), two cheap checks make the verdict precise and earn it a
park rather than a fixer-forward:

1. **Verify the suppression entry's source PR actually merged.** The issue often references a
   workaround "already added" — but the adding PR may still be OPEN, so the entry isn't even on
   master yet. For #11766, PR #11744 (adds the `scalar-fp8.slang (vk)` line to
   `tests/expected-failure-no-gpu.txt`) was still open; `grep` of the file at HEAD found no match.
   That makes the prerequisite explicit: PR #11744 must merge *before* this issue is even unblockable.

2. **Locate the concrete upstream tracker + fix PR** via a cross-repo `gh` search, to ground the
   "what unblocks this / blocker" bullet. `gh issue/pr list -R <upstream> --search "<keywords>" --state all`.
   For #11766 this surfaced KhronosGroup/SPIRV-Tools#6533 (the exact upstream bug:
   "assert(width...) should take fp8 into account in GetWordsFromScalarFloatConstant") and its
   in-progress fix PR #6677 ("spirv-opt: Fix assertion with fp8"). The assert itself is verifiable
   by reading the vendored submodule: `external/spirv-tools/source/opt/folding_rules.cpp:156`
   asserts `width == 16 || 32 || 64`.

3. **Check for a companion issue.** Dev-opened tracking issues often come in pairs opened seconds
   apart: a bug-side tracker (#11767, "test aborts...") and a cleanup follow-up (#11766, "re-enable
   once fixed"). They're complementary, NOT duplicates — cross-link, don't dedup.

Verdict shape for these: enhancement/tracking, low/P3, "handed off — awaiting external dependency."
**PARK the fixer-forward** (root defect is upstream; nothing actionable on the Slang side) but still
post the verified 5-bullet on the issue with the ordered resumption trigger. A local cherry-pick of
the upstream fix into the vendored submodule is the only thing that could give a fixer work now, but
it creates submodule drift maintainers don't want unless upstream stalls — mention it, don't do it.
Confirmed correct by orchestrator (2026-06-26).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md`_
