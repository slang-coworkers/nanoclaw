---
type: chain
title: slang#14398 — CPU/CUDA module-scope `static const` with `vector op scalar` emits `Vector<float,3> * float`
description: Bot-filed 2026-11-07 03:25Z by slang-triager, a side find from the #14396 review (#14036 chain). Filed-only and not a regression; related to #14330. Its issue_opened belongs to the #14036 chain — needs no dispatch.
tags: [cpu, cuda, static-const, simplify-for-emit, vector, filed-only]
---

# slang#14398 — module-scope `vector op scalar` is not widened on CPU/CUDA

**Bug (verified 11-07 on the issue).** `static const float3 kV = float3(1.0, 2.0, 3.0) * 2.0;` fails to compile downstream.
- On ptx (NVRTC) it gives "no operator \"*\"".
- shader-sharedlibrary (gcc) and host-callable (llvm) fail the same way.
- `int2 / 2` and `float2x2 * 2.0` fail too.
- SPIR-V passes. The same expression in a local variable compiles everywhere.
- v2026.13.1 already fails, so this is not a regression.

Suspected cause (triager's, not confirmed by a fix): `unifyBinaryExprOperands` (slang-ir-simplify-for-emit.cpp:344) runs only over `IRFunc` bodies (`processModule` :499-502). A module-scope initializer is therefore never widened.
- Related to [#14330](14330-cuda-vector-arith-static-const-dynamic-init.md): owned by jkwak-work, triage-only chain. Folding vector arithmetic there would fold the literal cases of #14398 too.
- The CPU failure shows that the widening gap is separate from #14330.

**Ownership.** It was filed by slang-triager from the [#14036 chain](14036-cuda-precise-fp-mode-rn-intrinsics.md) during the PR #14396 review.
- **Its `issue_opened` (Main session `sess-1794021938547-0vjmpt`) needs no dispatch.**
- It has the `reproduced` label and no assignee.
- No fixer chain: a new fixer chain needs an operator go-ahead (filing policy) or a maintainer ask.
- The issue body cross-references #14330, so the #14330 owner sees it on GitHub.
