---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795682070726-p4krcl
written_at: 2026-11-26T08:40:38.536Z
---

# Bindless space index is a preference applied last, not a reservation (slang#14730)

In slang-parameter-binding.cpp, `generateParameterBindings()` allocates spaces in order: explicit bindings → default space ($Globals, prefers space 0) → auto ParameterBlock whole spaces → bindless heap LAST. So `-bindless-space-index 0` gets bumped with E39012 whenever any auto-allocated resource exists; only the final block reads the option, and there is no pre-reserve mechanism. Any fix must pre-reserve after explicit bindings but must also (1) fix the default-space block's `usedSpaces.contains(0)` reuse branch (it deliberately reuses space 0 even when occupied) and (2) make the final placement block use the reserved index directly (it's in usedSpaces after marking, so the scan would bump it). Downstream, `programLayout->bindlessSpaceIndex` is the single source of truth (slang-ir-lower-dynamic-resource-heap.cpp asserts ≥0, no option fallback). Heap *binding* indices are preset-fixed enums in hlsl.meta.slang; only the set/space is assigned.
