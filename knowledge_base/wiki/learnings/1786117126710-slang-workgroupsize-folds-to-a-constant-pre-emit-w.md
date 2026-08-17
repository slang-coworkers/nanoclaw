---
title: "Slang WorkgroupSize() folds to a constant pre-emit; WorkgroupCount() is GLSL/SPIR-V only"
type: learning
topic: slang-compiler
source: learnings/1786117126710-slang-workgroupsize-folds-to-a-constant-pre-emit-w.md
---

# Slang WorkgroupSize() folds to a constant pre-emit; WorkgroupCount() is GLSL/SPIR-V only

Reading the thread-group extents from inside a Slang compute shader: **`int3 WorkgroupSize()`** (`source/slang/hlsl.meta.slang:7837`, `__intrinsic_op($(kIROp_GetWorkGroupSize))`, `[require(compute)]` + `[require(meshshading)]`). GLSL's `gl_WorkGroupSize` is a `uint3` property wrapping the same intrinsic (`glsl.meta.slang:151-159`).

⚠️ **Return type is signed `int3`, not `uint3`.** DeepWiki reports `uint3` — wrong. Corroborated by `tests/spirv/spec-constant-numthreads.slang`, which writes `int3 size = WorkgroupSize();`. Matters because you'll usually combine it with `uint` SV values.

**It is a compile-time constant, not a runtime builtin read.** `materializeGetWorkGroupSize` (`source/slang/slang-ir-translate-global-varying-var.cpp:438`) splices the `IRNumThreadsDecoration` **operands** into each use site. Two paths, per its own design comment at :431-436:
- single referencing entry point → direct constant substitution (`emitMakeVector`);
- a helper shared by entry points with *different* `[numthreads]` → a private global var + a store at the top of every function carrying the decoration (`tests/spirv/subgroup-size-2.slang` pins `OpVariable %_ptr_Private_v3int Private`).

Because it splices operands rather than literals, it is **not** restricted to literal extents — unlike `emitCalcGroupExtents`, which bails on non-`IRIntLit`.

**No per-target caveat — and this is the part I got wrong before checking.** I expected some backend to emit `blockDim`/`threads_per_threadgroup`. A positive-control grep of `GetWorkGroupSize` across all seven `source/slang/slang-emit-{hlsl,glsl,spirv,cuda,metal,wgsl,cpp}.cpp` returns **0 in every one**; the pass runs inside `linkAndOptimizeIR` outside any `switch (target)`, so the op is erased before emit everywhere. *Absence in the emitters was the evidence that it's portable, not that it's unsupported* — the opposite of the usual reading of a missing target arm. (WGSL has no test coverage though: say "untested", not "unsupported".)

**Spec constants in `[numthreads]` — sharp target split:**
- **SPIR-V/GLSL: works**, and `WorkgroupSize()` yields the spec constant at runtime (`tests/spirv/spec-constant-numthreads.slang` → `OpExecutionModeId … LocalSizeId` + `layout(local_size_x_id = 1)`). `IRNumThreadsDecoration` carries spec-const operands (`slang-ir-insts.h:336-347`, `getXSpecConst()`).
- **HLSL/Metal/WGSL/CPU: hard error at the attribute**, not at the call — *"Specialization constants are not supported in the 'numthreads' attribute"* from `CLikeSourceEmitter::getComputeThreadGroupSize` (`slang-emit-c-like.cpp:294-312`); only `slang-emit-glsl.cpp:1510` calls the spec-const-aware overload. Test: `tests/diagnostics/execution-model/spec-constant-numthreads.slang`.

**Don't confuse the two intrinsics** — "workgroup dimensions" is ambiguous and worth disambiguating with users. `uint3 WorkgroupCount()` (`hlsl.meta.slang:7842`, GLSL `gl_NumWorkGroups`) = *how many groups were dispatched*, and unlike `WorkgroupSize()` it is `[require(glsl_spirv, GLSL_430_SPIRV_1_0_compute)]`-gated with **no HLSL/CUDA/Metal/WGSL arm** — pass it via a constant buffer on those targets.

Practical note: `WorkgroupSize()` is a call, so it can't size a `groupshared` array. When extents are literals, `static const uint GROUP_X = 8;` used in both `[numthreads]` and the array bound is the simpler answer.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786117126710-slang-workgroupsize-folds-to-a-constant-pre-emit-w.md`_
