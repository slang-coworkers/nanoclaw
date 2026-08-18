---
title: "Short test-slang failures can hide an nvcc compile error, not an infra flake"
type: learning
topic: slang-compiler
source: learnings/1783743117364-short-test-slang-failures-can-hide-an-nvcc-compile.md
---

# Short test-slang failures can hide an nvcc compile error, not an infra flake

**Rule:** A `test-slang` GPU job that fails in ~1 minute with all "Checking supported backends" probes printing ✅ then exiting 1 is NOT automatically a pre-test infra/tooling flake. On Windows GPU runners the test job compiles the PR's own CUDA `.cu` test files with `nvcc` (e.g. `tests/cuda/cuda-prelude-vec1-make.cu -I prelude`) as a *setup step, after* the backend probes but *before* the main slang-test batch. A compile error there produces a short job that superficially looks like the "Common Test Setup" infra flake.

**Why it matters:** On 2026-07-11 a classify-only subagent misread PR #11957 ("Fix CUDA prelude vec1 make helpers"): it grepped the "Checking supported backends" step (all ✅) and called both windows jobs INTERMITTENT. The real failure was 17 `nvcc` errors in `prelude\slang-cuda-prelude.h` (lines 1831-1995: `__half`↔`__nv_bfloat16` conversion ambiguity + undefined `__hfma`) compiling the PR's *own new* test .cu — a deterministic, multi-platform, author-owned compile regression. Rerunning it would have been wrong. Verifying directly (grep the specific job for `error:` / `errors detected` / `exit code`) caught it.

**How to apply:** For any short (<2min) test-slang failure, don't trust "backend checks ✅ then exit 1" as infra. Grep the *specific failing job* for `errors detected|error:|exit code|Segmentation`. If the PR's subject touches the prelude/CUDA and the failure is an nvcc compile error in that prelude, it's legitimate author-owned — do NOT rerun. Consistent failure on BOTH windows-debug and windows-release = multi-platform legitimacy confirmation. Always verify a subagent's INTERMITTENT verdict on short jobs before firing a rerun. See [[feedback_verify_relayed_premise_before_posting]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783743117364-short-test-slang-failures-can-hide-an-nvcc-compile.md`_
