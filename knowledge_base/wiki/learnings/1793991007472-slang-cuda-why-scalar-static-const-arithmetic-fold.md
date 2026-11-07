---
title: "Slang CUDA: why scalar static-const arithmetic folds but vector arithmetic reaches NVRTC as a dynamic __device__ init"
type: learning
topic: slang-compiler
source: learnings/1793991007472-slang-cuda-why-scalar-static-const-arithmetic-fold.md
---

# Slang CUDA: why scalar static-const arithmetic folds but vector arithmetic reaches NVRTC as a dynamic __device__ init

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793989718117-k7ww13
written_at: 2026-11-06T18:50:07.472Z
---

# Slang CUDA: why scalar static-const arithmetic folds but vector arithmetic reaches NVRTC as a dynamic __device__ init

Verified on master fef74e3c6 (#14330). Scalar `10/4` in a `static const` initializer is folded by IR SCCP, which runs inside lowering (slang-lower-to-ir.cpp:15639) before the first `-dump-ir` LOWER-TO-IR dump. It is not AST folding, so the dump already shows literals. The SCCP evaluator is scalar-only (slang-ir-sccp.cpp:1024-1027: any non-IRBasicType result becomes Any). No IR pass folds vector arithmetic.

For CUDA, `isLegalGlobalInstForTarget` (slang-ir-legalize-global-values.cpp:295-305) rejects only IRCall and otherwise checks the type alone, so a vector `div`/`add` stays at module scope. CUDA vector operators and `make_*` are `inline __device__` and not constexpr, so NVRTC rejects them as a dynamic initializer.

Traps when you probe:
- (1) A single `int2 +`/`*` global looks fine only because the emitter folds a side-effect-free global into each use (slang-emit-c-like.cpp:1693-1697). Integer `/` and `%` with a non-literal divisor count as side effects (slang-ir.cpp:9799-9811) and become a named global. So test inside an array to see `+`/`*` fail.
- (2) Even a plain `static const int2 v = int2(10,7);` that a function reads through `float2(v)` fails on CUDA. The C++/CUDA fold veto for vector/matrix values used by casts (slang-emit-cpp.cpp:1954-2010) makes `v` a named global with a `make_int2(...)` initializer. That is the #13444 path, not the arithmetic legality path.
- (3) `int2(...)/2` at module scope is written as `int2 / int` (no operator). In a function body the emitter widens the scalar to `make_int2(int(2))`.

Also: when a codex OUTPUT_REVIEW reply contains only recall bullets, re-prompt with codex-reply to ask for the structured review.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793991007472-slang-cuda-why-scalar-static-const-arithmetic-fold.md`_
