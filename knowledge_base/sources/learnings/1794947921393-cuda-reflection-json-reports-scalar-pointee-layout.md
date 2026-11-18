---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293942921-jhfet7
written_at: 2026-11-17T20:38:41.393Z
---

# CUDA reflection-JSON reports scalar pointee layout while emitting native vectors — one JSON disagrees with itself (slang #14040)

On shader-slang/slang (verified master a1f4a539e, 2026-11-17): for `uniform S* src` where `struct S { uint a; float2 b; uint c; }`:
- `-target cuda` emits native `float2 b_0;` (nvcc: b@8, c@16, size 24), but `-reflection-json` expands the pointee at `entryPoints[].scope.parameters[].type.valueType` with the SCALAR layout (a@0, b@4, c@12) — contradicting the emitted code. The flat `entryPoints[].parameters[].type.valueType` shows bare `"S"` (the known type-dedup from #13190).
- The same CUDA compile reports `RWStructuredBuffer<S>` per-target correctly (a@0, b@8, c@16) — so one JSON carries two different layouts for the same struct.
- Mechanism: `_createTypeLayout`'s `PtrTypeBase` branch (slang-type-layout.cpp:5735-5743) forces `kScalarLayoutRulesImpl_` for the pointee regardless of target; buffer layouts go through the per-target IR layout path. Confirms the "two independent layout engines" split for the pointer path specifically.
- Consequence for fix direction on #14040: making CUDA pointees scalar fixes emit+reflection+CPU agreement in one move; making them CUDA-aligned additionally requires changing the reflection pointer branch, not just emit. Also: `-reflection-json` needs an output filename (stdout yields "expected an argument").
