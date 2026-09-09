---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786630536707-xz2mm7
written_at: 2026-08-13T18:00:40.522Z
---

# Slang CUDA/OptiX payload register count is carried by payloadSize, not the _optix_trace_typed_N name

Triaging shader-slang/slang#12528 (CUDA/OptiX 17-31 word payloads read past PayloadRegisters). Two non-obvious facts worth keeping:

1. **`_optix_trace_typed_32` is OptiX's ONE register-trace transport** — 32 inline-asm register slots are ALWAYS emitted regardless of payload size. The real payload word count is conveyed SOLELY by a separate `payloadSize = (int)sizeof...(Payload)` operand (external/optix-dev/include/internal/optix_device_impl.h:66, supplied to the asm at :81). So `_optix_trace_typed_32` appears in the PTX for N=8, N=16, N=40 too — even the >32 pointer fallback emits it with payloadSize=2. If you're triaging a "traced as 32 registers" report, DON'T fixate on the intrinsic name; grep the `payloadSize` immediate loaded before the trace call (measured: N=12→16, N=30→32, N=40→2). The bug is Slang passing the wrong number of `pr.regs[i]` ARGUMENTS (which sets sizeof...(Payload)), not the symbol.

2. **The prelude's optixTraceWithRegs / optixTraverseWithRegs / optixInvokeWithRegs (prelude/slang-cuda-prelude.h) each have explicit `if constexpr (N==0..8)` branches then TWO fixed-width catch-alls: `N<=16` passes regs[0..15], `N<=32` passes regs[0..31].** Both pass a FIXED operand count regardless of N, so PayloadRegisters<T,N> (allocates regs[N]) is over-read/over-written for N in [9,15] AND [17,31] — not just the [17,31] the reporter noticed. When a report cites one window of a "passes fixed count" bug, check the sibling catch-all branches for the same defect.

3. **Repro without a GPU:** both failure surfaces are compile-time — `slangc x.slang -target cuda` (source gen) and `-target ptx -Xnvrtc -I<slang>/external/optix-dev/include` (PTX gen). nvcc 12.6 + the in-tree OptiX headers are enough; the runtime hang is NOT reproducible headless, so scope the verdict to the codegen defect and disclaim the hang as "consistent with, not proven."

4. **OOB is read AND write**, not just read: OptiX's variadic optixTrace takes payload words by reference and assigns each returned value back (optix_device_impl.h:88), so the extra slots are out-of-bounds write targets at C++ source level = UB. But NVRTC scalarizes the struct, so the emitted PTX has undefined extra register operands in + discarded extra outputs, no materialized OOB stack loads/stores — distinguish source-level UB from PTX manifestation, don't claim stack corruption without a runtime.
