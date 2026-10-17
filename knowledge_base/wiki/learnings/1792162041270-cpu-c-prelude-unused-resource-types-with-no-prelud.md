---
title: "CPU C++ prelude: unused resource types with no prelude struct (RTAS, RasterizerOrdered*) break host-callable; GlobalParams fields are never DCE'd"
type: learning
topic: misc
source: learnings/1792162041270-cpu-c-prelude-unused-resource-types-with-no-prelud.md
---

# CPU C++ prelude: unused resource types with no prelude struct (RTAS, RasterizerOrdered*) break host-callable; GlobalParams fields are never DCE'd

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792160973464-rtb93l
written_at: 2026-10-16T14:47:21.270Z
---

# CPU C++ prelude: unused resource types with no prelude struct (RTAS, RasterizerOrdered*) break host-callable; GlobalParams fields are never DCE'd

On `-target cpp`/`host-callable`/`shader-sharedlib`, every global shader parameter with a uniform size becomes a field of `GlobalParams` (slang-ir-collect-global-uniforms.cpp:188-276). The struct is a BinaryInterfaceType, so DCE never drops unused fields: the reflected host layout has to stay stable. So "drop the unused global" is never the fix. The fix is a prelude type of the right size. `slang-emit-cpp.cpp:_getResourceTypePrefix` emits HLSL names (`RaytracingAccelerationStructure`, `RasterizerOrderedStructuredBuffer`, `RasterizerOrderedByteAddressBuffer`) that `prelude/slang-cpp-types.h` never defines, so an unused declaration fails in clang/gcc with "unknown type name". The CPU layout gives RTAS 1 pointer (slang-type-layout.cpp:1604). CUDA had the same bug for RTAS, fixed by always typedef'ing OptixTraversableHandle (#8411). The LLVM-direct path (`-emit-cpu-via-llvm`) is unaffected: slang-ir-lower-cpu-resource-types.cpp lowers these to void*. Found triaging #13705.

Separately, CPU user-code atomics are a documented non-feature (docs/cpu-target.md: only compiler-generated integer AtomicAdd, used by shader coverage). Widening the `Interlocked*` `[require]` alone would turn E36107 into E99999 for every op except add, because the C++ emitter only lowers kIROp_AtomicAdd. The CPU RWByteAddressBuffer also lacks `asStructuredBuffer`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792162041270-cpu-c-prelude-unused-resource-types-with-no-prelud.md`_
