---
title: "CORRECTION: SPIR-V SER at 1.4 without PSB — bundled spirv-val ACCEPTS it (triage claim overturned)"
type: learning
topic: slang-compiler
source: learnings/1784102979347-correction-spir-v-ser-at-1-4-without-psb-bundled-s.md
---

# CORRECTION: SPIR-V SER at 1.4 without PSB — bundled spirv-val ACCEPTS it (triage claim overturned)

**Correction to prior learning "SPIR-V SER capability over-requires 1.5; capdef floor edit alone is insufficient" (slang#12097).**

My triage stated as **CONFIRMED** that a SPIR-V 1.4 shader-invocation-reorder (SER) module *without* a physical-storage-buffer (PSB) extension declared would **fail `spirv-val`**. During the fix (PR #12115) this was empirically **OVERTURNED**: the bundled `spirv-val` **accepts** the 1.4 SER module even with no PSB `OpExtension`. So spirv-val does not enforce the SER extensions' normative 1.4 dependency on a physical-storage-buffer extension.

**Consequence for the fix:** declaring `SPV_KHR_physical_storage_buffer` on the <1.5 SER path is still the right thing, but the justification is **spec-correctness** (the EXT/NV SER extension specs list PSB as a normative 1.4 dependency) and the maintainer's stated Approach A — **not** because validation forces it. Don't cite "spirv-val fails otherwise" as the motivation.

**Method lesson:** during triage I marked the validation-failure as CONFIRMED without actually running spirv-val on the counterfactual (1.4 SER module with PSB stripped) — I inferred it from the spec dependency. A spec "requires X" does not imply the local validator enforces X. When a triage claim is load-bearing for the fix design, either (a) run the tool to confirm, or (b) label it a hypothesis. Here it should have been a hypothesis ("likely fails spirv-val per spec dep") not "CONFIRMED".

**Fix shape that shipped (PR #12115, Approach A):** capdef `SPV_EXT_shader_invocation_reorder` floor `_spirv_1_5`→`_spirv_1_4` (NV + motion aliases inherit); `slang-emit-spirv.cpp` declares `SPV_KHR_physical_storage_buffer` **centrally in `requireSPIRVCapability`** when a SER capability is required at effective version <1.5 (plain `OpExtension`, no `PhysicalStorageBuffer64` addressing switch — memory model stays `Logical GLSL450`); extracted `requireShaderInvocationReorderExtension()` to dedup the two HitObject NV/EXT sites. Codex CODE review caught that a HitObject-only placement would miss the `ReorderThread` spirv_asm path at 1.4 → hence the central chokepoint. Floor semantics verified: `-profile spirv_1_5/1_6` keep core 1.5, no spurious PSB.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784102979347-correction-spir-v-ser-at-1-4-without-psb-bundled-s.md`_
