---
title: "slang bwd_diff out-param convention — bare in-differential seed, no primal writeback"
type: learning
topic: slang-compiler
source: learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md
---

# slang bwd_diff out-param convention — bare in-differential seed, no primal writeback

# `bwd_diff` out/inout param convention (corrects the "ride existing machinery" assumption)

When designing autodiff features that touch `out`/`inout` parameters, do NOT assume `bwd_diff` already has machinery to carry primals or pairs through out params. The actual reverse-mode convention (DeepWiki-verified against shader-slang/slang, Jun 2026):

- A differentiable **`out T y`** param of `f` becomes **`in T.Differential`** in the synthesized backward function — a *bare differential-typed cotangent seed*, NOT a `DifferentialPair<T>`, NOT `inout`. (Implemented in `BwdDiffFuncType::_resolveImplOverride`, `ParamPassingMode::Out` → `diffValueType`.)
- `bwd_diff` writes back **no primal values** to `out`/`inout` params. For an `inout DifferentialPair<T>`, only `.d` (the gradient) is updated; `.p` is left untouched. This is the contract documented in `tests/autodiff/reverse-inout-param-0.slang:29` ("should be 5, since bwd_diff does not write back new primal val").
- By contrast, **`fwd_diff`** shapes a differentiable `out T y` as **`out DifferentialPair<T>`** carrying both `.p` (primal) and `.d` (tangent). Forward mode surfaces out-param primals; reverse mode does not.
- The out-param primals ARE materialized in the primal-context intermediates during primal hoisting — so a feature that *wants* to surface them (e.g. `value_and_bwd_diff` on a void + out-param function) has the data available, but the writeback itself is **net-new code**, not reuse.

## Why this matters

On shader-slang/slang#11372, a proposal to support void-returning `f` with out params via "turn out into inout, primal written back" was framed as "rides the existing out→inout mechanism bwd_diff already implements." That framing is wrong on two axes:

1. **Param-transformation axis:** bwd_diff's out param is bare `in T.Differential`. To carry a primal back you need a *different* param shape (recommended: `inout DifferentialPair<T>` with `.d`=input cotangent seed, `.p`=output primal) — a new transformation in the resolver, distinct from just changing the return type.
2. **Writeback axis:** extracting each out-param primal from intermediates and writing it through the param is code bwd_diff does not have.

Lesson: before greenlighting an autodiff out-param feature as "easy/existing machinery," check the actual `_resolveImplOverride` param transformation and whether primal writeback exists. The fwd/bwd asymmetry means forward-mode intuitions ("out params already carry .p") do NOT transfer to reverse mode.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md`_
