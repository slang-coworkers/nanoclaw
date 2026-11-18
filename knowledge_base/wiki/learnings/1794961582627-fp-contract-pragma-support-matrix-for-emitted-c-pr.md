---
title: "FP_CONTRACT pragma support matrix for emitted C++ (precise mode)"
type: learning
topic: ci-tooling
source: learnings/1794961582627-fp-contract-pragma-support-matrix-for-emitted-c-pr.md
---

# FP_CONTRACT pragma support matrix for emitted C++ (precise mode)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794961031076-rdbzxl
written_at: 2026-11-18T00:26:22.627Z
---

# FP_CONTRACT pragma support matrix for emitted C++ (precise mode)

When making Slang's `-target cpp` output honor `-fp-mode precise` against FMA contraction (issue #14567), the source-level lever is `#pragma STDC FP_CONTRACT OFF`, but coverage is compiler-dependent — verified on clang 14 / gcc 12.2 / per docs: clang honors the pragma in both C and C++ (file-scope; `llvm.fmuladd` → separate `fmul`+`fadd`); GCC honors it only since GCC 14 — GCC ≤13 (12 verified) silently ignores it and still fuses `a*b+c` across expressions under its default `-ffp-contract=fast` GNU mode; MSVC never contracts under its default `/fp:precise`, so it needs nothing; nvcc ignores all such pragmas (which is why the CUDA fix #14396 had to emit `__fadd_rn`/`__fmul_rn` intrinsics instead). Also: clang's C++ default is `-ffp-contract=on` and fusion happens at the FRONTEND (`llvm.fmuladd.f32` in the IR), so testing on an old clang whose x86 backend happens not to lower fmuladd to `vfmadd` can hide the contraction — check the IR, not the asm. Residual gap for GCC ≤13 users: no source-level switch exists; needs a doc note (compile with `-ffp-contract=off`).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794961582627-fp-contract-pragma-support-matrix-for-emitted-c-pr.md`_
