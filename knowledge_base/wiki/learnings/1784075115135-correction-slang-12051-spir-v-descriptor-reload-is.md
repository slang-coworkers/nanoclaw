---
title: "CORRECTION slang#12051: SPIR-V descriptor reload is an EMIT-time OpLoad-per-use, NOT shouldDuplicateInstAtUseSite — verify emit, not just IR"
type: learning
topic: slang-compiler
source: learnings/1784075115135-correction-slang-12051-spir-v-descriptor-reload-is.md
---

# CORRECTION slang#12051: SPIR-V descriptor reload is an EMIT-time OpLoad-per-use, NOT shouldDuplicateInstAtUseSite — verify emit, not just IR

**Corrects my earlier #12051 root-cause attribution.** I'd said the SPIR-V per-use descriptor reload comes from `shouldDuplicateInstAtUseSite` force-duplicating `kIROp_CastDescriptorHandleToResource` (`slang-ir-util.cpp:2638`). That is NOT the mechanism on the default SPIR-V path, verified at HEAD ad69c2e9f by code read + IR dump + disassembly.

**Actual mechanism (default SPIR-V path, `DescriptorHandle<T>` hoisted into a local before a loop, sampled 3×):**
1. In the GENERIC IR (what `-dump-ir` shows), after hoisting the conversion the descriptor is a **single shared value** — one `getElement(__slang_resource_heap, index)` (default) or one `SPIRVLoadDescriptorFromHeap` (spvDescriptorHeapEXT). It is NOT duplicated at the IR level. `shouldDuplicateInstAtUseSite` force-dups `CastDescriptorHandleToResource`, but on the default path the conversion has already lowered to `getElement`, which is single.
2. The per-use triplication is introduced **during SPIR-V EMISSION** — `legalizeIRForSPIRV` + the emit walk in `slang-emit-spirv.cpp` (called from `emitSPIRVFromIR`, `slang-emit-spirv.cpp:11913`), which runs **AFTER** the final generic `-dump-ir` snapshot. That's the reconciliation of the puzzle: IR dump shows ONE load, disassembly shows THREE.
3. At emit, the descriptor value realizes as: a shared `OpAccessChain` into the heap (the index math — emitted **once**) + an `OpLoad` **dereference re-emitted at each use site**. Disassembly of the hoisted case: `%24 = OpAccessChain ... %__slang_resource_heap %10` once, then `%32/%43/%52 = OpLoad %19 %24` three times. Measured: **2 OpAccessChain, 6 OpLoad** (3 texture + 3 sampler) for 3 samples. The access chain is shared; only the dereference repeats.
4. `pinDescriptor()`/`OpCopyObject` collapses it to a single `OpLoad` reused by all three `OpImageSampleExplicitLod` — proving the per-use reload is NOT a SPIR-V validity requirement, just the current emit strategy.

**Meta-lesson (the reusable one):** `-dump-ir` shows the GENERIC pipeline only. Target-specific IR legalization (`legalizeIRForSPIRV`) and the emit walk run AFTER that snapshot and are invisible to `-dump-ir`. So an IR-dump inst count can UNDER-report what the backend actually emits — a value that is single in the dumped IR can still be re-materialized per-use at emit. For any "how many times does X happen in the output" claim on SPIR-V, DISASSEMBLE the actual output (`-target spirv-asm`); do not infer emit-count from the IR dump. This is exactly the trap that produced my earlier misattribution.

**Design consequence for the fix (option a, jkwak's front-runner):** the lever is in the SPIR-V emit/legalize path (materialize one `OpLoad` when the descriptor-load def dominates its uses AND pointer/index are invariant), NOT a change to the generic `shouldDuplicateInstAtUseSite`. Guard must be dominance + INVARIANCE (not dominance alone) to stay correct under divergent/`NonUniformResourceIndex` indexing. `NonUniformResourceIndex`/`__copyObject` live in hlsl.meta.slang (~:13923 / ~:13930). HLSL is unaffected (resource value directly storable, no separate load step → local already reused).

`c_o` = `f_i_ndings`: `NonUniformResourceIndex` is a `__intrinsic_op(kIROp_NonUniformResourceIndex)` in hlsl.meta.slang; preserving its decoration is the one correctness risk if descriptor loads are de-duplicated.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784075115135-correction-slang-12051-spir-v-descriptor-reload-is.md`_
