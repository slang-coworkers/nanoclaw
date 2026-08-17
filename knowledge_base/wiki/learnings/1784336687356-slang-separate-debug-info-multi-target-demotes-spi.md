---
title: "Slang separate-debug-info: multi-target demotes SPIRV out of whole-program → per-EP debug artifacts abort the count==1 assert"
type: learning
topic: slang-compiler
source: learnings/1784336687356-slang-separate-debug-info-multi-target-demotes-spi.md
---

# Slang separate-debug-info: multi-target demotes SPIRV out of whole-program → per-EP debug artifacts abort the count==1 assert

shader-slang/slang#12147 (separate-debug-info-output). `SLANG_RELEASE_ASSERT(debugArtifactCount == 1)` at slang-end-to-end-request.cpp:766 is defended by the comment "Direct-SPIR-V output is whole-program, so its entry points share one debug artifact." That premise holds ONLY for a single target.

Mechanism: the SPIRV target gets `SLANG_TARGET_FLAG_GENERATE_WHOLE_PROGRAM` only when a `rawOutput` is matched to it (slang-options.cpp:4672-4677). Without an explicit per-target `-o`, the ONLY thing that auto-creates that rawOutput is the implicit-output synthesis at slang-options.cpp:4566, which is **gated on `m_rawTargets.getCount() == 1`**. Add a second `-target` and that synthesis is skipped → SPIRV stays per-EP → `_collectExistingOutputArtifacts` (line 428) takes the per-entry-point branch → 1 debug-bearing artifact PER entry point → 2 EPs = count==2 = abort (E99997 ICE, exit 255).

Precise trigger: **≥2 `-target`s + ≥2 entry points + no per-target `-o` for the SPIRV target.** Single-target (any EP count) is fine (whole-program synthesis); multi-target with 1 EP is fine; multi-target + explicit `-o` is fine.

Review lesson: when a maintainer/bot dismisses a "count>1" assert as "out of contract," check whether their repro varied the ENTRY-POINT count, not just the target list. Here the production bot re-investigated `spirv+spirv-asm` and correctly noted spirv-asm's Assembly-payload artifact doesn't increment the count — but held EP count at 1. With 2 EPs, `spirv+spirv-asm` ALSO aborts, because the SPIRV target's own per-EP artifacts reach 2 independent of the second target. The count multiplier is entry-point count on a per-EP target, not the second target's contribution.

Principled fix (matches the sibling): `_validateCoverageManifestOutputPaths` already diagnoses the identical multi-artifact shape gracefully (`CoverageManifestOutputMultipleArtifacts`, SLANG_FAIL, line 838). The separate-debug validator should do the same instead of RELEASE_ASSERT.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784336687356-slang-separate-debug-info-multi-target-demotes-spi.md`_
