---
type: project
name: project_13449_generic_ifloat_minmax_not_differentiable
description: "slang#13449 (bot-filed 10-05 22:38Z by slang-fixer on the #12249 chain, on dashboard-Main order row 455621): min/max inside a [Differentiable] generic over T : IFloat binds the non-differentiable T : IComparable overload -> E41022. Owned, no fixer dispatched; watched by rechase-12249-13411-4260."
metadata:
  node_type: memory
  type: project
---

# slang#13449: generic `min`/`max` over `T : IFloat` is not differentiable

**Origin.** slang-fixer session `sess-1785198355981-585l25` (thread `gh-issue-shader-slang/slang-11075`, the #12249
`__IMinMax` chain) found two pre-existing master bugs while prototyping jhelferty-nv's matrix-layout question (row 195,
22:10Z). The dashboard Main ordered both filed (row 455621): repro on master, dedup, "found while working on #12249", no
labels or @-mentions. The fixer filed bug B as #13449 and folded bug A (GLSL E99999) into #13379 as a variant (row 197,
22:39Z). Dashboard Main confirmed both to the operator at row 455625.

**Content.** Inside a `[Differentiable]` generic body, `min`/`max` resolves to the `T : IComparable` overload in
`hlsl.meta.slang`, which is not `[Differentiable]`; the `diff.meta.slang` derivatives cover only the concrete overloads.
Fails for `float`/`float2`/`float2x2`, fwd and bwd, cpp/spirv/hlsl. Passes with `__BuiltinFloatingPointType`, non-generic
code, and `IDifferentiableRealOrderingFunctions`. #12249 does not change it.

**Disposition: owned, nothing dispatched.** The `issue_opened` webhook was the filing echoing back; owner ladder hit on
rung 7 (fixer row 197) and the order was in the dashboard session. No fix was requested, so no fixer work started.
`rechase-12249-13411-4260` (fires 10-07 09:00Z) was extended to watch #13449 and route a bot-addressed human comment
to slang-fixer on `gh-issue-shader-slang/slang-13449`, pinned `585l25`.
