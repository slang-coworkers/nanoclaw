---
title: "SlangPy vector-return autodiff bug triages to slang-core transpose, not front-end"
type: learning
topic: slang-compiler
source: learnings/1783881108388-slangpy-vector-return-autodiff-bug-triages-to-slan.md
---

# SlangPy vector-return autodiff bug triages to slang-core transpose, not front-end

## When a SlangPy `[Differentiable]` function gives silently-wrong gradients, attribute to slang-core autodiff transpose — not SlangPy marshalling — when the fingerprint matches.

Case: shader-slang/slangpy#1055 — gradients silently wrong ONLY when a `[Differentiable]` function BOTH contains a loop AND returns a vector (`float3`); exact for the *identical* body with a scalar return; exact for a loop-free `float3` return (passes `torch.autograd.gradcheck`). Forward always correct.

**Why front-end is excluded (source-traced, reusable):**
- SlangPy's backward codegen is *structurally identical* for scalar vs vector return — same `[Differentiable] _trampoline` + single `bwd_diff(_trampoline)` call, no multi-component special-casing (`slangpy/core/generator.py:566-618,877`; `boundvariable.py:503-593`; `tensorcommon.py:373-418`). The scalar-vs-vector distinction lives entirely in the marshall element type; the emitted control flow is the same. Correctness rests entirely on Slang's `bwd_diff` transpose of `_result = func(...)`.
- slangpy-torch interop passes `grad_output` through UNMODIFIED and *validates* shape (`src/slangpy_ext/utils/slangpy.cpp:542-609`; `slangpytorchtensor.cpp:67-103`). A shape mismatch would THROW, not silently mis-scale — so a silent-wrong result cannot originate in the torch interop.

**How to apply:** For a "silently wrong gradient" SlangPy issue, the diagnostic split is: does the SlangPy-generated code differ by the triggering variable (return arity, loop presence)? If NOT (as here), and the torch path validates+passes-through, the bug is in the compiler's reverse-mode transpose. Precedent: slang#12070 (Autodiff/bug/reproduced) — `bwd_diff` of a `[Differentiable]` loop already known-broken. Reduction path for the fixer: confirm on pure-Tensor `.bwds()` first (drops torch entirely) → minimal pure-Slang `bwd_diff` repro → escalate to shader-slang/slang.

**Test-coverage gap that lets this ship:** the only vector-return autograd test (`test_torch_autograd_workflows.py:371-421`, float2) asserts loss-DECREASED only and explicitly waives the param check; the rigorous analytic-grad-parity test (`:436`) uses a SCALAR return. A per-component vector-gradient error is not caught today — worth a per-component analytic parity test when the fix lands.

Related: `[[slang-bwd-diff-out-param-convention-bare-in-differ]]`, transpose-pass gradient-type mismatch learnings.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783881108388-slangpy-vector-return-autodiff-bug-triages-to-slan.md`_
