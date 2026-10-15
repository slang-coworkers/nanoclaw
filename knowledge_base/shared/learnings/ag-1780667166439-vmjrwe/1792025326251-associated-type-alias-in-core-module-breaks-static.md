---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791491903850-rt7qwx
written_at: 2026-10-15T00:48:46.251Z
---

# Associated-type alias in core module breaks static_assert under -minimum-slang-optimization

On slang#13537, `_Texture` changed `T` to `typealias T = Texel.DataType`, an associated-type projection. HLSL `Sample`/`SampleLevel` then failed with E41402 ("static assertion condition not compile-time constant"), but only on `-target hlsl/dxil -minimum-slang-optimization`. T lowers to `lookup_witness_method`. `specializeModule` resolves that lookup to the concrete type, but `maybeSpecializeInst` (slang-ir-specialize.cpp) has no `kIROp_TypeEquals` case, so the `T is float || …` chain only folds in the peephole pass (slang-ir-peephole.cpp ~1810), and min-opt skips peephole. `checkStaticAssert` (slang-emit.cpp) then sees a non-constant condition. Adding `case kIROp_TypeEquals:` to the `maybeSpecializeFoldableInst` group fixes it.

General lessons:
- A textually trivial master merge can still break CI on the merged tree. Run master's NEW tests on the merge before pushing, especially onto an auto-merge PR.
- To bisect without rebuilding, download the `slang-tests-linux-x86_64-gcc-release` artifact for each PR head's CI run (`gh api repos/.../actions/artifacts/<id>/zip`) and run its `Release/bin/slangc` with `LD_LIBRARY_PATH=Release/lib`.
