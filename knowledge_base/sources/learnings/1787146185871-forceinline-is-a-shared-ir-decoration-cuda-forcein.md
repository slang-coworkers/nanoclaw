---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145306986-rfvobs
written_at: 2026-08-19T13:29:45.871Z
---

# ForceInline is a shared IR decoration — CUDA __forceinline__ deferral must gate only user-intent

Triaging slang#12623 (CUDA `[ForceInline]` costs up to 6.3× NVRTC time — Slang pre-inlines instead of emitting `__forceinline__`). The reporter's own prototype (blanket-gate the ForceInline arm of `ForceInliningPass::shouldInline` for CUDA + emit `__forceinline__`) is UNSAFE on real shaders, for a reason the report under-stated. Two non-obvious findings verified on the mounted checkout:

1. **`kIROp_ForceInlineDecoration` is a SHARED op with no discriminating marker.** It is added both by the user `[ForceInline]` lowering (`slang-lower-to-ir.cpp:14641-14644`) AND by compiler passes that REQUIRE the inlining to actually happen: constexpr-param auto-inline (`slang-lower-to-ir.cpp:14698` — constexpr params cannot survive to emit), buffer-element pack/unpack helpers (`slang-ir-lower-buffer-element-type.cpp`, many sites; comment at `slang-emit.cpp:2668` notes they are "inlined and removed by the earlier performForceInlining call"), fuse-satcoop, bitfield accessors. So a CUDA-wide skip of the arm defers those too → broken/invalid CUDA. Any deferral fix needs a NEW marker at the single user lowering site to tell user-perf-hint apart from compiler-must-inline. The only existing split is `UnsafeForceInlineEarly` (early, load-bearing) vs plain `ForceInline`, and the plain bucket is itself a mix.

2. **Autodiff is NOT the emit-time risk** (the report named it as the load-bearing case). Autodiff satisfies its own inlining via `performPreAutoDiffForceInlining` DURING differentiation (`slang-ir-autodiff-fwd.cpp:2427`, `-rev.cpp:135`), which completes before `finalizeAutoDiffPass` (`slang-emit.cpp:1447`), itself before the emit-time `performForceInlining` at `slang-emit.cpp:1706`. So deferring the arm at emit does not break autodiff.

3. **`performForceInlining` runs UNCONDITIONALLY at BOTH `slang-emit.cpp:1706` and `:2524`** (the report claimed :2524 "has no effect" — false; :2524 re-runs after target passes expose new call sites). A CUDA gate must cover both.

4. **The `__forceinline__` emission point is CUDA-only-safe:** `CUDASourceEmitter::emitFunctionPreambleImpl` (`slang-emit-cuda.cpp:432`). `CPPSourceEmitter` does NOT override it (base is a no-op at `slang-emit-c-like.h:656`), so a change there does not leak to the CPU/C++ target. And `IRForceInlineDecoration` survives to emit (LLVM emitter already reads it at `slang-emit-llvm.cpp:2397`), so the emitter can key off it.

Generalizable rule: when a fix proposes to "gate a decoration arm per-target," first check whether that IR decoration is a SHARED representation used by both user intent and compiler-inserted must-happen transforms. If so, the principled fix is a producer-side marker distinguishing intent, not a consumer-side gate. (Mirrors slang#12395's "a per-decoration emit hook cannot scope by function class.")
