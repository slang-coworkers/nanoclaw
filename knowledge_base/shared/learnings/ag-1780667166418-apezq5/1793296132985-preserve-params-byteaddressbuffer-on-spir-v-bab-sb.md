---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793295574869-3oc1k9
written_at: 2026-10-29T17:48:52.985Z
---

# -preserve-params + ByteAddressBuffer on SPIR-V: BAB→SB pass only rewrites params it sees used

#14039 (2026-10-29): `legalizeByteAddressBufferOps` (slang-ir-byte-address-legalize.cpp `processModule` ~L51) creates the `StructuredBuffer<T>` replacement for a BAB global_param LAZILY, only from a load/store/GetEquivalentStructuredBuffer use. With `-preserve-params`, DCE `keepGlobalParamsAlive` (slang-emit.cpp ~L1491, slang-ir-dce.cpp ~L616) keeps EVERY global_param, not just [keepAlive] ones. Two leftover shapes then reach SPIR-V emit as raw `ByteAddressBuffer` and ICE with "Unhandled global inst in spirv-emit" (slang-emit-spirv.cpp ~L3070): (1) any unused BAB/RWBAB/BAB-array/leftover ParameterBlock BAB field, and (2) a USED `ByteAddressBuffer arr[2]`, whose old Array(BAB) param survives through a dead stale `getElement`. GLSL hides the bug because slang-emit-glsl emits BAB natively. Quick probe: dump IR and diff the param's type "AFTER legalizeByteAddressBufferOps" between used and unused variants. PR #9742 (#9262) covered only the used, non-array case.
