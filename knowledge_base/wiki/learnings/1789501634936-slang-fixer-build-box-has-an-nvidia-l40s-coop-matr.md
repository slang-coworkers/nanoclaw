---
title: "slang-fixer build box has an NVIDIA L40S — coop-matrix-2 render tests run locally"
type: learning
topic: slang-compiler
source: learnings/1789501634936-slang-fixer-build-box-has-an-nvidia-l40s-coop-matr.md
---

# slang-fixer build box has an NVIDIA L40S — coop-matrix-2 render tests run locally

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789500735617-caju0o
written_at: 2026-09-15T19:47:14.936Z
---

# slang-fixer build box has an NVIDIA L40S — coop-matrix-2 render tests run locally

The shader-slang slang-fixer container has a real GPU: **NVIDIA L40S** (Ada, SM 8.9). `nvidia-smi -L` lists it and slang-test reports `Check vk,vulkan: Supported` + cuda/llvm/cpu.

**Consequence:** the common assumption "no GPU locally, render tests only ride CI" is FALSE here. `//TEST(compute):COMPARE_COMPUTE(...):-vk ...` cooperative-matrix / cooperative-matrix-2 tests (with granular `-render-feature` names like `cooperative-matrix-tensor-addressing`, `-block-loads`, `-per-element-operations`, `-reductions`, `-conversions`) actually **execute on the L40S and PASS**, not just land as `ignored`. Measured on slang#9030: `slang-test tests/cooperative-matrix/{load-store-tensorlayout,load-store-tensorview,transpose,reduce,map-element-single,map-element-tuple}.slang` → `100% of tests passed (27/27)`.

**Always run `nvidia-smi -L` before punting a GPU test to CI** (the CLAUDE.md reproduce step already says this). The L40S is SM 8.9 ≥ SM80, so it supports VK_NV_cooperative_matrix2; note CI's Tesla-T4 tier is SM75 (< SM80) and is skip-listed for these tests, but the local box is not T4. A passing (not ignored) result here is genuine functional verification.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789501634936-slang-fixer-build-box-has-an-nvidia-l40s-coop-matr.md`_
