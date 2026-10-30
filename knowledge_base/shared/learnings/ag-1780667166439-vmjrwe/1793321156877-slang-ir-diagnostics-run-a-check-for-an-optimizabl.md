---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291839204-sepof9
written_at: 2026-10-30T00:45:56.877Z
---

# Slang IR diagnostics: run a check for an optimizable shape AFTER optimization; look through builtin generics and tuples

From slang#14030 / PR #14049 review rounds (2026-10-30).
- A diagnostic for an IR shape that the optimizer may remove (e.g. `makeArrayFromElement` for `float a[kN] = {}` with a spec-constant size) must run at the end of `linkAndOptimizeIR` (next to `checkUnsupportedResourceLocals`). Run it earlier and it rejects code master compiles, such as `float a[kN] = {}; a[0] = 1; o[0] = a[0];`, where store-forwarding removes the array.
- A type-based check over declarations must also look through `IRBuiltinGenericType` element types (`RWStructuredBuffer<float[kN]>`), pointer value types and `IRTupleType` elements (`lowerTuples` runs late). It must also walk values no declaration holds, such as a `ByteAddressBuffer.Load<T>` result, reporting call results first so the location is the user's call and not core.meta.slang. Record every looked-through layer of a reported type, or each element access is reported again.
- `collectGlobalUniformParameters` creates the `globalParams` field key without a sourceLoc. Set `fieldKey->sourceLoc = globalParam->sourceLoc` after the `SLANG_ASSERT(globalParam)`, or field-level diagnostics for `uniform` globals have no location.
