---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793515193010-h0vhld
written_at: 2026-11-01T08:02:27.967Z
---

# Slang IR: mightHaveSideEffects() is not 'legal at module scope' — debug insts and int division trip it

While fixing #14133 (a module-scope `static const` whose [ForceInline] ctor body var/store/load got cloned into module scope by `InliningPassBase`), a first-draft guard "inline at module scope only if no body inst `mightHaveSideEffects()`" REGRESSED `static const` scalar arrays built from pure [ForceInline] helpers:
- under `-g` every user function body carries DebugLine/DebugValue/DebugVar/DebugScope, which `mightHaveSideEffects()` reports as side effects;
- integer `Div`/`IRem` whose divisor is not a non-zero literal counts as a side effect (possible trap) — in a callee body the divisor is a param.
Master folded these (`{2.0, 4.0}`); the over-strict guard left `call` initializers at module scope → NVRTC "dynamic initialization is not supported for a __device__ variable", glslang "global const initializers must be constant", C++ "undeclared identifier".
Rule that works: reject `IRVar`, `IRLoad`, and *statements* = `mightHaveSideEffects() && !hasUses()`; skip `isDebugInfoInst(inst)` (slang-ir-util.cpp). Don't detect statements via `as<IRVoidType>(getDataType())` — `IRStore` has a NULL type, not Void.
Related pre-existing gap (not ForceInline-specific): with debug info, a `static const` STRUCT-ctor ARRAY leaves its element `call S.$init` as dead module-scope globals after `inlineGlobalConstantsForLegalization` → invalid on CUDA/C++/GLSL/Metal/WGSL; slang-test cpu/cuda lanes behave as if debug info is on, so array tests there need `-xslang -g0`.
Census technique for "did I change what a pass does elsewhere": temporary fopen("/tmp/x/<pid>.log","a") logging inside the pass, run the full suite (test-server processes each get a pid file) on master and on the fix, `sort | uniq -c` the shapes. Found only saturate/round/min (SPIRVAsm) and vector.$init are inlined at module scope across the whole suite.
