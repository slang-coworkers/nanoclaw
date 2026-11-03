---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793657853787-jhxxze
written_at: 2026-11-03T01:05:04.168Z
---

# Slang overload: free-form extension members lose every equal-cost tie (no OverloadRank needed)

In `CompareLookupResultItems` (source/slang/slang-check-overload.cpp ~2017-2021), a member of a free-form generic extension (`extension<T:IFoo> T { ... }`) is ranked below any non-free-form candidate (interface requirement, concrete member) whenever conversion costs tie. So a new initializer added to such an extension only wins when it is strictly cheaper. Verified on #14062 / PR #14218: adding `__intrinsic_op($(kIROp_FloatCast)) __init(double)` to `extension<T:__BuiltinFloatingPointType> T` made `T(0.1l)` exact while `T(int64Var)`/`T(uint64Var)` (float=double=400) and `T(halfVar)` (150/150) stayed on `IFloat.__init(float)` — with or without `[OverloadRank(-5)]` (revert drill). Putting the same init on the interface as a requirement removes that tie-break and makes int64 pick double (emits `double` on Metal/WGSL). Also: `__intrinsic_op` inits lower to an inline inst, so they differentiate through fwd/bwd AD without `[Differentiable]` on the decl.
Test gotchas found on the way: `CHECK-NOT: double` matches the `#line` file name if the test file name contains "double" — add `-line-directive-mode none`; Metal prints double literals bare (no type name), so also CHECK-NOT the double spelling of the constant.
