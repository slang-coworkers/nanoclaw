---
title: "slang #12116: NonUniform float-pass guard-asymmetry is a nit, not a bug"
type: learning
topic: slang-compiler
source: learnings/1784536684181-slang-12116-nonuniform-float-pass-guard-asymmetry-.md
---

# slang #12116: NonUniform float-pass guard-asymmetry is a nit, not a bug

PR #12116 (follow-up to #12110/#12051 cluster) adds two SPIR-V-gated cases to `processNonUniformResourceIndex` (`slang-ir-float-non-uniform-resource-index.cpp`): `kIROp_CastUInt2ToDescriptorHandle` and `kIROp_MakeVector`, so the `NonUniformResourceIndex` wrapper floats across the DescriptorHandle round-trip `makeVector(idx,0) → CastUInt2ToDescriptorHandle → CastDescriptorHandleToUInt2 → swizzle → getElement` and reaches the heap-subscript index the SPIR-V decoration machinery consumes. Fixes dropped `OpDecorate NonUniform` (VUID-RuntimeSpirv-None-10148) on the DEFAULT (no `spvDescriptorHeapEXT`) SPIR-V heap path.

**Recurring reviewer flag (expect it):** the new cases carry `if (floatMode != SPIRV) break;` while the pre-existing sibling `CastDescriptorHandleToUInt2` (and `IntCast`) float unconditionally. Devin, clarity-C001, AND a cross-backend reviewer (conf 90, self-labeled "Bug") all flag this asymmetry and the fact the same round-trip shape is produced by target-agnostic core-module lowering (`hlsl.meta.slang:27612`), reaching the Textual (HLSL/GLSL/WGSL) float pass too.

**Correct adjudication = NOT a bug / not a regression:**
- The new cases did not exist pre-PR → on non-SPIRV targets the wrapper hit the switch `default` both before AND after. PR is purely additive + SPIR-V-gated → zero non-SPIRV behavior change (verify with `git show <base>:file` vs `<head>:file`).
- File-header design contract (lines ~25-57 at head) is explicit: Textual mode intentionally emits NO decoration; HLSL `NonUniformResourceIndex(index)` / GLSL `nonuniformEXT(index)` are HINTS the downstream compiler (DXC/glslang) propagates, so the wrapper only needs to be *near* the index. SPIR-V's `OpDecorate NonUniform` is position-specific → the only consumer that needs the wrapper floated to the exact access index. That's why the gate is correct, not inconsistent.
- Cross-backend's own conf-70 companion Question concedes it couldn't run DXC/glslang to prove the HLSL hint is actually mis-honored when stranded upstream.

So: whether HLSL/GLSL *should also* float through the round-trip is a **pre-existing, unproven, separately-scoped** improvement — file as follow-up, don't block. Real asks are: (1) test the `onlyConstantSiblings==false` branch (untested), (2) make the "mirror" comment's floatMode-asymmetry invariant explicit. Verdict: APPROVE_WITH_NITS.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784536684181-slang-12116-nonuniform-float-pass-guard-asymmetry-.md`_
