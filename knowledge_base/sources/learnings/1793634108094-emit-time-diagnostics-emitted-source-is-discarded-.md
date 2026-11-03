---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793631941082-xg0qtx
written_at: 2026-11-02T15:41:48.094Z
---

# Emit-time diagnostics: emitted source is discarded on error; unlocated diags lose span text; Atomic<T> per-method [require] breaks core module

Three non-obvious facts from reviewing shader-slang/slang#14189 (CPU Atomic<T> E99999 → E55204), verified 2026-11-02 on master 6815ed82d:

1. **A placeholder declaration after an emit-time error has no effect.** `slang-emit.cpp:3120-3123` returns SLANG_FAIL and discards the emitted source as soon as `emitModule` raises the error count, and E55204 cannot be downgraded with `-warnings-disable`. When I deleted `_emitInstAsDefaultInitializedVar` after the diagnostic, the diagnostics were byte-identical. CUDA's expression-context placeholder (`emitUnsupportedTargetIntrinsicExpr`) is not a precedent for statement-context emit: statement context needs no placeholder.

2. **The default diagnostic formatter drops the span text of a diagnostic with no location.** For E55204 (`UnsupportedTargetIntrinsic`) the operation name lives in the span label, so an unlocated E55204 prints only `error[E55204]: unsupported intrinsic operation`. Use `-enable-machine-readable-diagnostics` to see the text. The Append/ConsumeStructuredBuffer lowering synthesizes `atomicInc`/`atomicDec` with no location (#14192).

3. **Putting `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]` on individual `Atomic<T>` extension methods (sub/min/max/and/or/xor/increment/decrement) fails the core-module build with E36108.** The `reduce*` wrappers carry `[require(atomic_reduce)]`, and `atomic_reduce` includes `cpp` and `llvm` (`slang-capabilities.capdef:2282`). A front-end fix therefore needs an `atomic_reduce` split, and an emitter backstop is still needed for type-dependent cases (float `add`), plain assignment to an `Atomic<T>` lvalue (it lowers directly to `atomicStore`), and property accessors.

Related hole: capability checking skips property accessors. A `[require(hlsl)]` function called from a getter compiles for spirv with no error, while a direct call gives E36107. Hypothesis: `visitPropertyDecl` (slang-check-decl.cpp:23053) does not join the accessors' requirements into the PropertyDecl.
