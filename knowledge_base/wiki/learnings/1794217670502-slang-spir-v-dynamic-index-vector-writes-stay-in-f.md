---
title: "Slang SPIR-V: dynamic-index vector writes stay in Function memory; [ForceUnroll] output is SSA only because spirv-opt promotes it"
type: learning
topic: slang-compiler
source: learnings/1794217670502-slang-spir-v-dynamic-index-vector-writes-stay-in-f.md
---

# Slang SPIR-V: dynamic-index vector writes stay in Function memory; [ForceUnroll] output is SSA only because spirv-opt promotes it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794214647063-qdddiv
written_at: 2026-11-09T09:47:50.502Z
---

# Slang SPIR-V: dynamic-index vector writes stay in Function memory; [ForceUnroll] output is SSA only because spirv-opt promotes it

Found in shader-slang/slang#14415 (2026-11-09).
- Slang's `isPromotableVar` (slang-ir-ssa.cpp:478) never promotes a local var that has element-pointer stores, whether the index is constant or dynamic. So `float3 v; v[a] = x;` is always emitted as a Function OpVariable plus `OpAccessChain` + `OpStore`.
- At -O1/-O2, Slang runs spirv-opt on its output (slang-emit.cpp ~3705). spirv-opt SROA/mem2reg promotes access chains with a constant index. That is why the unrolled code is pure SSA (`OpPhi %v3float` + `OpCompositeInsert`), while the rolled, dynamic-index code stays in memory. At -O0, spirv-opt does not run at all.
- Slang never emits `OpVectorInsertDynamic` (only `OpVectorExtractDynamic`, slang-emit-spirv.cpp:8976). There is no emit case for UpdateElement; eliminatePhis turns it back into a var + element store.
- Source workaround that keeps the loop rolled: `diag = select(uint3(0,1,2) == a, d, diag)`. This compiles to OpPhi/OpSelect on v3float, with no Function var.
- Harness pitfall: `RWStructuredBuffer<float3>` on Vulkan has a std430 stride of 16, not 12. Check `ArrayStride` in the spvasm before writing a host-side checker. My first run reported 39M "bad" components purely because of this.
- A raw-Vulkan compute harness with a host checker and a planted-bug control is at /workspace/agent/scratch-14415/harness.cpp. Reading HOST_VISIBLE|COHERENT memory back is slow: about 3 s per 2M-thread iteration, so 200 iterations is about 10 min per variant.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794217670502-slang-spir-v-dynamic-index-vector-writes-stay-in-f.md`_
