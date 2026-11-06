---
type: source
title: "slangpy#1261 R2 review — APPROVE"
---

# Review: shader-slang/slangpy#1261 — Support torch.bfloat16 tensors in the torch bridge (round 2)

- **Head:** `bee91422` (one test-only commit on top of `4d0592d0`; base main `68d1e782`, Slang 2026.20)
- **Mode:** pr (round 2). The round-1 review is at `reports/review-1261/review-shader-slang-slangpy-1261-r1.md`.
- **Verdict:** APPROVE

## Summary

Every round-1 finding is resolved or documented. The delta changes 3 test files (+12 / −11). No product code changes: `git diff 4d0592d0 bee91422 -- src slangpy/torchintegration slangpy/core` is empty. CI is fully green at `bee91422`: 15 pass and 1 skipping (CodeRabbit). That includes both Windows jobs, where `test_bfloat16_tensor_write[native|fallback-vulkan]` now PASS.

## Round-1 findings

| Finding | Status | Evidence |
|---|---|---|
| **B1:** the Vulkan write test assumed RNE | ✅ Fixed | `test_torchintegration.py:1590-1592` uses `linspace(...).to(torch.bfloat16).float()`. I checked that the low 16 bits are zero for every input and that RTZ == RNE. Windows Release (job 126999777921) gives `6320 passed, 0 failed`, with both bf16 Vulkan cases PASSED. Windows Debug (job 126999778310) succeeded. |
| **G1:** bf16 autograd error | ✅ Documented | The explanation comment's out-of-scope list now has "Autograd through BFloat16". It names the binding error and notes that non-differentiable functions work. |
| **G2:** fallback auto-output untested | ✅ Fixed | `test_torch_output_bfloat16` takes `torch_bridge_mode`; `[native]` and `[fallback]` both PASS on the L40S. |
| **N1:** to_numpy test gating and exception type | ✅ Fixed | The `Feature.bfloat16` gate moved to `test_bfloat16_to_torch` only, and the test expects `RuntimeError`. The ungated test passes on the Windows d3d12/vulkan/cuda runners. |
| **N2:** `dtype_to_data_type` asymmetry | ✅ Acknowledged | Noted with the follow-ups (CoopVec has no bf16 either). |
| **Q1:** Vulkan E41012 profile warning | ✅ Acknowledged | Listed as a possible follow-up in `compiler_target.cpp`. |
| **Q2:** Vulkan bf16 rounding (`escalate-to-slang`) | ✅ Acknowledged | Passed to the parent as a candidate Slang issue. |
| Unrelated half-autograd segfault (on main already) | ✅ Passed on | Passed to the parent as a separate issue. |

## Verified (facts)

- **L40S, Linux, Slang 2026.20.** All 18 bf16 test cases pass on CUDA and Vulkan, with the native and fallback bridges.
- **Touched suites** (`test_torchintegration`, `test_torch_dtypes`, `test_dtypes`, `test_bridge_fallback_gaps`, `test_reflection2`, `utils/test_torch_bridge`): **935 passed, 92 skipped, 0 failed**.
- **Explanation comment.** It is updated for head `bee9142`. It records the `4d0592d` Windows failure and the RTZ cause. The worked bit pattern is right: -1.7265625 is `0xBFDD`.
- **PR description.** The Tests line is now scoped to the L40S. It is still within the 4-section format.

## Remaining (non-blocking)

None for this PR. These follow-ups are outside it:
- the Slang RTE rounding question
- bf16 `IDifferentiable` in Slang
- `spvBFloat16KHR` capability selection
- the half-autograd segfault on main

```json
{"verdict":"APPROVE","bugs":0,"gaps":0,"questions":0,"diff_hash":"edd2e7ba602e9e298215f8905001d861131129ef53ffe388666d2c9075b856bc","reviewers_complete":true}
```
