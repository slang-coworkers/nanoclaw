---
title: "slang autodiff — return shape rule for new diff operators (fwd/bwd asymmetry)"
type: learning
topic: slang-compiler
source: learnings/1780285608597-slang-autodiff-return-shape-rule-for-new-diff-oper.md
---

# slang autodiff — return shape rule for new diff operators (fwd/bwd asymmetry)

# Return shape rule for new autodiff operators in Slang

When designing a new autodiff operator that surfaces a return value (e.g. `value_and_bwd_diff`, hypothetical `value_and_fwd_diff`, `vjp_with_value`, etc.), apply this test to decide whether the return type should be bare `R` or `DifferentialPair<R>`:

- **Forward mode produces an output tangent** (`df/dx · dx`). The tangent is *computed* by the operator, so wrapping in `DifferentialPair<R>` is meaningful: `.p = f(x)`, `.d = computed tangent`. This is why `fwd_diff(f)` returns `DifferentialPair<R>`.
- **Backward mode consumes an input cotangent** (`dL`, the user-supplied seed). The cotangent of `f`'s return is an *input* to the operator, not an output. There is no "computed cotangent of the result" to put in a `.d` field; backward mode does not synthesize one, it starts from one. Therefore the return type should be bare `R`. DeepWiki on shader-slang/slang confirms this verbatim: *"there is no 'differential of the result' field in the return type of `bwd_diff(f)` because the result's differential is provided as an input."*

The general rule: **if the operator's surface *produces* the differential of the return, use `DifferentialPair<R>`; if it *consumes* the differential of the return as input, use bare `R`.** Cosmetic symmetry with the other-mode operator is not a sufficient reason — the math is asymmetric, and forcing pair-wrapping on backward-mode-style operators puts a meaningless or redundant value in `.d`.

This came up on #11372 (Q1 of the design signoff): the user proposed `bwd_diff(f)` should return `DifferentialPair<R>` for symmetry with `fwd_diff(f)`. Rejected for the reason above; ship `value_and_bwd_diff(f) -> R` instead. The same rule will apply to any future operator in this family.

Secondary signal: when the operator gains a `[XBackwardDerivativeOf(f)]`-style custom-override attribute, can the user write a sensible override body? If `R`-bare, yes (`return f(x)` is the natural body). If `DifferentialPair<R>`, the user has to construct `DifferentialPair<R>(value, ???)` with no defensible value for `.d` — that's a tell that the pair-wrapping is wrong.

Source: shader-slang/slang#11372 maintainer signoff 2026-06-01; cross-checked against DeepWiki on shader-slang/slang.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780285608597-slang-autodiff-return-shape-rule-for-new-diff-oper.md`_
