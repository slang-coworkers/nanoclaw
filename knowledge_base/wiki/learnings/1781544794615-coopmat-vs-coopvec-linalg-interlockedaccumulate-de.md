---
title: "CoopMat vs CoopVec linalg InterlockedAccumulate — DeepWiki conflates them"
type: learning
topic: slang-compiler
source: learnings/1781544794615-coopmat-vs-coopvec-linalg-interlockedaccumulate-de.md
---

# CoopMat vs CoopVec linalg InterlockedAccumulate — DeepWiki conflates them

When triaging Slang cooperative-matrix (`CoopMat`) coverage vs HLSL SM 6.10 `linalg` (microsoft/hlsl-specs proposal 0035), watch two traps:

**1. DeepWiki conflates cooperative-VECTOR and cooperative-MATRIX accumulate.** Asked "does Slang support SM 6.10 linalg `Accumulate`/`InterlockedAccumulate`?", DeepWiki answers "yes" and cites `coopVecOuterProductAccumulate` / `coopVecReduceSumAccumulate` / `__slang_linalg_VectorAccumulate` → `dx::linalg::InterlockedAccumulate`. Those are all cooperative-**vector** ops. The cooperative-**matrix** `Matrix::Accumulate(Matrix<A/B>)` and `Matrix::InterlockedAccumulate(RWByteAddressBuffer/groupshared)` are genuinely **absent** from `struct CoopMat` (`source/slang/hlsl.meta.slang:~27789`). The string `InterlockedAccumulate` appears in `slang-emit-hlsl-prelude.cpp` only inside CoopVec helpers — a name collision, not matrix support. Always confirm CoopMat method coverage by reading `hlsl.meta.slang` directly, not from DeepWiki.

**Why:** verified at HEAD 03e1cb7a6 during triage of #11613; 5 code subagents agreed the matrix forms are absent (no meta.slang method, no IR op, no emit path, no test), while DeepWiki claimed they exist.

**2. Portability is split, and that's the load-bearing triage point.** Matrix-form `InterlockedAccumulate` (atomic accumulate of a coop matrix into a buffer/groupshared) is HLSL/DXC-specific: `SPV_KHR_cooperative_matrix` has only Load/Store/MulAdd (plain store, no atomic accumulate); the only SPIR-V atomic-accumulate ops are the NV cooperative-VECTOR ones. So exposing it cross-target isn't free — it'd be a HLSL-gated intrinsic + unsupported-target diagnostics, or a maintainer decision to document as out-of-scope. The implemented coop-VECTOR `VectorAccumulate` (PR #11213, issue #10742) is the exact wiring precedent if someone does implement the matrix form.

**How to apply:** For "does Slang support linalg function X" triage, the verdict hinges on (a) reading the `CoopMat` struct in hlsl.meta.slang, not DeepWiki, and (b) checking whether X has a portable SPIR-V/CUDA/Metal analogue before recommending anything beyond a HLSL-gated intrinsic. PR #10711 ("Support CoopMat for SM 6.10") body documents exactly which CoopMat methods were intentionally implemented vs deferred.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781544794615-coopmat-vs-coopvec-linalg-interlockedaccumulate-de.md`_
