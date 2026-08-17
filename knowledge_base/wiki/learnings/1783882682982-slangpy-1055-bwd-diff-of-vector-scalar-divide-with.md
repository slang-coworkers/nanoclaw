---
title: "slangpy#1055: bwd_diff of vector/scalar divide with coupled loop accumulators is silently wrong"
type: learning
topic: slang-compiler
source: learnings/1783882682982-slangpy-1055-bwd-diff-of-vector-scalar-divide-with.md
---

# slangpy#1055: bwd_diff of vector/scalar divide with coupled loop accumulators is silently wrong

**Symptom (as reported):** silently-wrong input gradients when a `[Differentiable]` Slang function has a loop AND returns a vector, on the slangpy-torch autograd path. Forward exact, backward garbage (sign flips, wrong magnitude).

**Actual root cause (isolated by ablation, 2026-07-12):** the *return type is a red herring*. The trigger is the Slang **compiler** reverse-mode autodiff transpose of a **vector-by-scalar divide (`float3 / float`)** where the vector numerator and scalar denominator are **both loop-carried differentiable accumulators** sharing the loop weight (the normalized-weighted-sum / softmax / bilateral pattern). Minimal failing case: `float3 num/den` then `.x+.y+.z` → WRONG; identical math but scalar numerator, or collapse-to-scalar-*before*-dividing → EXACT. This reconciles the reporter's "scalar control passes": their scalar control divided in scalar space.

**Attribution: shader-slang/slang, NOT slangpy.** Reproduces in a standalone pure-Slang compute kernel calling `bwd_diff` directly on a `float3[N]` value param — no SlangPy marshalling, no DiffTensor, no atomics, no torch. Also reproduces on pure-Tensor `.bwds()` (excludes torch interop + C++ grad pass-through). Deterministic (bit-identical across runs → not an atomic race); central FD stable across eps → genuine wrong math. Present on Slang 2026.5.2 under both slangpy 0.41.0 and 0.42.0 (not a 0.41→0.42 regression).

**Repro methodology that worked (reusable):**
- Ground truth = central finite differences THROUGH the same slangpy/slang forward (no external reference needed).
- Clean-harness rule: create a FRESH function/module instance per phase (run FD forwards, then bwds) — reusing one function across forward-after-bwds hit stale calldata-cache state and false "Missing required output gradients" / spurious WRONG. This bit me once.
- To get a standalone bwd_diff kernel dispatching in slangpy: use ENTRYPOINT parameters (`void computeMain(uint3 tid:SV_DispatchThreadID, RWStructuredBuffer<float> buf, ...)`) + `mod.computeMain.dispatch(uint3(1,1,1), buf=t.storage, ...)`. Module-scope global `RWStructuredBuffer` do NOT bind via dispatch kwargs → CUDA_ERROR_ILLEGAL_ADDRESS. Pattern is in `slangpy/tests/slangpy_tests/test_raw_dispatch.py`.
- float3-element Tensor: `Tensor.empty(device, shape=(L,), dtype=spy.float3)` then `.storage.copy_from_numpy(arr_Lx3)`.
- Env: `pip install --break-system-packages numpy pytest` (PEP668 container); run scripts with `PYTHONPATH=<repo-or-wheel-dir>` (slangpy.testing.helpers imports pytest).
- Fetched reporter's exact version to test version hypothesis: `pip download slangpy==0.42.0 --no-deps` then `pip install --target=<dir>` and run with that on PYTHONPATH.

**Workaround for users:** do the divide in scalar space — reduce to scalar before dividing (`s=num.x+num.y+num.z; return s/den;` is exact), or divide component-wise via scalar temporaries. Escalate the vector/scalar divide bug to shader-slang/slang; sibling slang#12070 (bwd_diff of loops).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783882682982-slangpy-1055-bwd-diff-of-vector-scalar-divide-with.md`_
