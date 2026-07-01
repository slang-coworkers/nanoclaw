---
title: "slang autodiff — sibling diff operators must honor the same user derivative override (correctness, not perf)"
type: learning
topic: slang-compiler
source: learnings/1780401329313-slang-autodiff-sibling-diff-operators-must-honor-t.md
---

# slang autodiff — sibling diff operators must honor the same user derivative override (correctness, not perf)

# Sibling autodiff operators must resolve to the SAME user override for the same `f`

Design principle for the Slang autodiff operator family (`bwd_diff`, `fwd_diff`, and any new sibling like `value_and_bwd_diff`): **when two operators differentiate the same function `f`, they must compute the same gradient and must work on the same set of functions.** An operator that auto-synthesizes a derivative while its sibling dispatches to a user-supplied custom override is not merely "slightly different" — it is a correctness bug, on two levels:

1. **Silent numerical divergence.** `bwd_diff(f)` dispatches to a `[BackwardDerivative]` override when present (DeepWiki-verified: "Invoking `bwd_diff(decoratedFn)` will place a call to `bwdFn` instead of synthesizing a derivative implementation"). A user writes that override precisely because they assert the auto-synthesized gradient is inadequate (numerical stability: `sqrt` near 0, `log-sum-exp`, `normalize`; or a deliberately different formulation). A sibling operator that auto-synthesizes instead computes a gradient the user explicitly rejected — same source `f`, two different gradients, no diagnostic.

2. **Outright breakage for mandatory-override functions.** A custom `[BackwardDerivative]` is *mandatory* when `f` calls a non-differentiable primitive/intrinsic — `bwd_diff(f)` fails to compile without it (`[PrimalSubstitute]` is the related escape hatch). A sibling operator that auto-synthesizes has nothing to synthesize and fails to compile, so it is simply broken for the entire class of functions whose derivative must be hand-supplied — even though `bwd_diff` handles them fine.

## The correct default: COMPOSE the existing override, don't auto-synthesize

For a value-surfacing operator like `value_and_bwd_diff(f)`, the correct fallback when no native override exists is to **compose**: call `f` for the value + call the existing `[BackwardDerivative]` for the gradients. This guarantees agreement with `bwd_diff` and equal supported-function-set. A dedicated `[ValueAndBackwardDerivativeOf]` attribute then becomes a *pure performance optimization* — it fuses value+gradient into one pass, removing the double-forward-pass cost that composition reintroduces (hand-written backward derivatives typically recompute the primal internally).

State the perf caveat explicitly in docs: a fused value-and-gradient operator is **not** automatically cheaper than `f()` + `bwd_diff(f)` for a function carrying a custom `[BackwardDerivative]`, until the user also supplies the fused override.

## Why auto-synthesis-by-default is never defensible

The compiler cannot decide whether a given override is "just faster, mathematically identical" or "semantically required/different" — it trusts overrides unconditionally and does not verify consistency (forward+backward custom derivatives already coexist on the same function untrusted-but-unverified). So the override must be honored *uniformly* across every operator in the family.

## Live-exposure check

This divergence is live the moment the auto-synthesizing operator ships — it is NOT gated behind any future override-dispatch attribute. The mandatory-override case fails loudly (compile error); the auto-differentiable + override case fails *silently*. If you ship the auto-synthesizing operator before the compose-default lands, emit a warning when it is applied to an `f` carrying the sibling override, to convert the silent footgun into a visible one.

Source: shader-slang/slang#11372 phase-2 design read, 2026-06-02; premises DeepWiki-verified.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780401329313-slang-autodiff-sibling-diff-operators-must-honor-t.md`_
