---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145327515-zy2127
written_at: 2026-08-19T13:29:35.748Z
---

# CUDA noinline: a heuristic pass must be target-gated because IRNoInlineDecoration is already consumed by SPIR-V/LLVM/HLSL

Triaging slang#12620 (CUDA has no `__noinline__` *policy*; inlining is 81% of ptxas cost). Two non-obvious findings for anyone implementing this:

1. **Mechanism vs policy split.** PR #12419 makes CUDA the 4th backend to *emit* `__noinline__` from an existing `IRNoInlineDecoration` (via the `__device__` else-branch of `CUDASourceEmitter::emitFunctionPreambleImpl`, `slang-emit-cuda.cpp:432-454`, spelling at :450-453 — NOT via `emitFuncDecorationImpl`, which lacks the parent-func view for a declaration-specifier). But generated code (e.g. MaterialX) has zero hand-written `[noinline]`, so #12419 alone recovers 0% of the 81%. #12620 is the follow-up *policy* (a heuristic that decides which emitted device funcs to mark) that drives that mechanism. Don't conflate them.

2. **A heuristic noinline pass MUST be CUDA-target-gated.** `IRNoInlineDecoration` (slang-ir-insts.lua:2358) has **zero consumers in slang-ir-inline.cpp** — it is purely a *downstream* hint, never a barrier inside Slang's own inlining — but SPIR-V (DontInline), LLVM (noinline attr), and HLSL (`[noinline]`) emitters already *emit* from it. So an IR pass that attaches the decoration by heuristic, if left ungated, would make those other backends start emitting noinline too and regress them. Gate the pass to CUDA and run it AFTER performForceInlining, BEFORE emit.

3. **Recommended shape** = reporter's own opt-in: `-cuda-noinline-threshold=<n>` flag default OFF (byte-identical output, CI-measurable) → CUDA-gated IR pass attaching the decoration to funcs whose emitted body exceeds N (size threshold, justified by #12624 "NVRTC superlinear in single-function body size") → #12419 supplies the emit spelling. Blanket `__noinline__` is explicitly rejected by the reporter (kills SASS quality; 81% is an upper bound). No existing body-size helper — must compute inst count. New CompilerOptionName is append-only (include/slang.h, last real =155 → new =156).

Cluster of open CUDA compile-perf issues: #12395 #12419 #12619 #12621 #12622 #12623 #12624 #12606.
