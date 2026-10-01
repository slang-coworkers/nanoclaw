---
title: "CUDA/OptiX: rewriting a global param into an opaque intrinsic before specializeResourceUsage breaks helper specialization, so SBT data gets __ldg"
type: learning
topic: slang-compiler
source: learnings/1790827641249-cuda-optix-rewriting-a-global-param-into-an-opaque.md
---

# CUDA/OptiX: rewriting a global param into an opaque intrinsic before specializeResourceUsage breaks helper specialization, so SBT data gets __ldg

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787219896820-wq66t1
written_at: 2026-10-01T04:07:21.249Z
---

# CUDA/OptiX: rewriting a global param into an opaque intrinsic before specializeResourceUsage breaks helper specialization, so SBT data gets __ldg

Found while reviewing shader-slang/slang#12646 (global `shaderRecordEXT` ConstantBuffer → OptiX SBT on CUDA). Everything here was reproduced on a Release build.

**Rule 1: IR pass order matters for resource specialization.**
- `specializeResourceUsage` (slang-emit.cpp ~:2097) specializes a callee's ConstantBuffer/resource param only when the call-site arg is a `kIROp_GlobalParam` (slang-ir-specialize-resources.cpp ~:740). Any other opcode gives `ThisFuncFailed`.
- If an earlier pass (here the OptiX pass at ~:1391) replaces the global with an opaque intrinsic such as `GetOptiXSbtDataPtr`, then `float4 readIt(ConstantBuffer<T> cb)` stops being specialized. The raw SBT pointer flows into the param.
- The `isPointerToImmutableLocation` walker can't see the `GetOptiXSbtDataPtr` root through a function param, so the callee emits `__ldg(&cb->field)`. That is the #10188 stale-SBT-read bug.
- The same early placement crashed slangc on a use inside an `expand` body: `IRExpand` owns a block but is not an `IRGlobalValueWithCode`, and `specializeModule` (~:1552) hadn't run yet.
- It also made a reference-graph diagnostic miss interface/generic calls: before specialization the call graph doesn't follow witness tables.
- Moving the rewrite to just after `specializeResourceUsage` fixed all three.
- Review probe: `readIt(gSbt)` with a ConstantBuffer-typed param, then grep the callee for `__ldg`.

**Rule 2: `moveGlobalVarInitializationToEntryPoints` injects EVERY global initializer into EVERY entry point** (slang-ir-explicit-global-init.cpp ~:107-114, 187-240), even entry points that never reference the global.
- Any per-entry-point diagnostic built from `buildEntryPointReferenceGraph` before that pass (CUDA/CPU run it late, ~:2483) is unsound for uses inside a `static` initializer.
- Example: an RT entry point and a compute entry point in one compile, plus `static uint x = gSbt.id;`. The compute kernel ends up calling `optixGetSbtDataPointer()` with no error.
- On SPIR-V, spirv-val catches the analog (VUID-07119). On CUDA nothing does.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790827641249-cuda-optix-rewriting-a-global-param-into-an-opaque.md`_
