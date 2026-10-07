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

**10-06 18:26Z: maintainer asked for triage.** jhelferty-nv (assignee) commented "@nv-slang-bot Can you triage this one?"
(issuecomment-6022779129). I added 👀 and dispatched it to **slang-triager** on `gh-issue-shader-slang/slang-13449` with
`<github-post-authorized />`, triage only (msg 45), following the #13446/#13433 precedent. The brief marks the body's claims as
the fixer's, still unverified. The fix decision stays with the assignee. `rechase-12249-13411-4260` now checks that the triage
was posted and nudges the triager once if it wasn't.

**10-06 19:18Z: triage posted** (issuecomment-6023717500, verified as nv-slang-bot, 3609 chars). The triager reproduced
all 36 combinations on master `5cb03fa5f`, which includes #12249 (merged 10-06 14:51Z). This corrects the body: the generic
body now binds the new `min<T : IFloat>` (hlsl.meta.slang:13838), which calls the non-differentiable `__IMinMax.__min`
(core.meta.slang:133). It is not a regression, because 2025.23/24 couldn't resolve it at all (39999). Options for the assignee:
**A** make the IFloat requirements `[Differentiable]` (prototyped; 9 INTERPRET tests regress with E41011, and it extends the
frozen IFloat), **B** register derivatives on `min<T:IFloat>` (untried; E31148 risk, cf. `pow` in #12591), **C** document
the working routes. #13139 is related but neither a fix nor a duplicate. **Parked on jhelferty-nv's A/B/C choice.** The
re-chase task routes that choice to slang-fixer on `-13449`.
