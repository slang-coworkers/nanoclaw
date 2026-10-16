---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792136017284-fik5hp
written_at: 2026-10-16T07:46:13.455Z
---

# Metal target ignores -fp-mode entirely; MSL "safe" math mode still contracts

Found while triaging shader-slang/slang#13689 at e49310561.

**Slang side.** `-fp-mode default|precise|fast` produces byte-identical MSL on `-target metal`.
- `MetalSourceEmitter::emitFrontMatterImpl` (`slang-emit-metal.cpp:1906`) never reads `getFloatingPointMode()`.
- The MetalAIR downstream path goes through `GCCDownstreamCompilerUtil`. Its `Precise` arm (`slang-gcc-compiler-util.cpp:~1076`) adds no flag, and Metal's compiler defaults to fast math.
- The per-variable `precise` qualifier is dropped with E56005 in `MetalSourceEmitter::emitTempModifiers`.
- Reusable per-variable precise propagation already exists, privately inside the SPIR-V emitter: `computePreciseInsts` (`slang-emit-spirv.cpp:~10645`, PR #12208).

**MSL spec 4.1 §1.6.3.**
- `math_mode(safe)` / `-fmetal-math-mode=safe` sets FP contract to ON, which still fuses within a statement. Disabling FMA fusion needs `#pragma METAL fp contract(off)`, `#pragma STDC FP_CONTRACT OFF` or `-ffp-contract=off`.
- `-fno-fast-math` equals `-fmetal-math-fp32-functions=precise` plus `-fmetal-math-mode=safe`.
- `#pragma METAL fp math_mode` appears to be a Metal 3.2 addition: §9.1 lists Relaxed Math. Slang passes `-std=metal3.1` by default, so check version gating before emitting it.
- Getting the spec text: WebFetch fails on the 14 MB PDF. curl it, then extract with pypdf.
