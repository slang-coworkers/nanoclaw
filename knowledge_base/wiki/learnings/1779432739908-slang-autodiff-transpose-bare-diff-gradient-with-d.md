---
title: "slang autodiff transpose: bare-diff gradient with DiffPair aggPrimalType causes crash"
type: learning
topic: slang-compiler
source: learnings/1779432739908-slang-autodiff-transpose-bare-diff-gradient-with-d.md
---

# slang autodiff transpose: bare-diff gradient with DiffPair aggPrimalType causes crash

# Slang autodiff transpose: type mismatch when extracting diff field

When `transposeLoad` (source/slang/slang-ir-autodiff-transpose.cpp) extracts
the differential field of a pair-typed loaded value to make gradients
bare-diff, the **`aggPrimalType` passed to `emitAggregateValue` must also be
narrowed** to the pair's inner primal type. Otherwise
`emitDAddOfDiffInstType` looks up `DiffPair.dadd` (because primalType is
`DiffPair`) and emits a call that, when inlined, applies pair-typed
accessors (`GetPrimal`/`GetDifferential`) to bare-diff arguments → crashes
the field-accessor lowering with `"Unrecognized field. Cannot emit field
accessor"`.

The pattern that surfaces in the IR dump (issue #11160 repro):
```
%46 : Vec(Float, 2) = get_field(%42, %differential)   # legitimate
%51 : Vec(Float, 2) = get_field(%47, %differential)
%52 = GetPrimal(%46)        # MALFORMED — %46 is a Vec, not a pair
%53 = GetPrimal(%51)
%54 = add(%52, %53)         # this whole sequence is the inlined body
%55 = GetDifferential(%46)  # of `DiffPair<Vec>.dadd(%46, %51)`
%56 = GetDifferential(%51)
%57 = add(%55, %56)
%58 : DiffPair = MakeDiffPair(%54, %57)
```

The triage for #11160 identified A1 (transposeMakePair guard) + A2
(materializeDifferentialPairGetElementGradients guard) + A3 (transposeLoad
diff-field extract) but **omitted the corresponding `aggPrimalType`
narrowing**. Without that, A3 introduces a type mismatch that produces the
same crash.

## How to apply
In `transposeLoad`, when `loadType` is `IRDifferentialPairType`, narrow
`aggregatePrimalType = loadPairType->getValueType()` and pass that to
`emitAggregateValue` instead of the original `primalType` from the diff inst
decoration (which is the full pair type).

## Why
`emitDAddOfDiffInstType(builder, primalType, op1, op2)` dispatches via
`getAddMethodForType(primalType)`. For pair-typed `primalType` it returns
`DiffPair.dadd` whose body is pair-only. For element-typed `primalType`
(Vec, scalar, etc.) it returns the element's `dadd` which is a plain `add`
matching the bare-diff operands.

Reproduce: bwd_diff of a function that internally fwd_diffs another
`[Differentiable]` function with `out` parameters. Exact repro in the issue
body.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779432739908-slang-autodiff-transpose-bare-diff-gradient-with-d.md`_
