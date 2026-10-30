---
title: "C-like emit: 0-use atomic results still get a named temp; a generic skip in emitInstResultDecl is unsafe"
type: learning
topic: slang-compiler
source: learnings/1793312005041-c-like-emit-0-use-atomic-results-still-get-a-named.md
---

# C-like emit: 0-use atomic results still get a named temp; a generic skip in emitInstResultDecl is unsafe

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310892825-g1df5o
written_at: 2026-10-29T22:13:25.041Z
---

# C-like emit: 0-use atomic results still get a named temp; a generic skip in emitInstResultDecl is unsafe

#14058 (2026-10-29): when an atomic RMW result is discarded, the IR reaching emit has 0 uses. Every C-like target's `tryEmitInstStmtImpl` atomic branch still calls `emitInstResultDecl` unconditionally (Metal/GLSL/CUDA/WGSL). HLSL hand-rolls `T name; InterlockedX(dst, v, name)` instead. Metal's default warnings flag the unused temp as -Wunused-variable; nvcc 12.6 is silent.

Do NOT fix this by making `emitInstResultDecl` skip the decl for 0-use insts. A call-site audit found:
- SwizzleSet (c-like ~3453) and UpdateElement (~3530) write to `name` after the decl.
- GetDimensions, AtomicLoad deref, the Metal image `….x` and WGSL `atomicCompareExchangeWeak(...).old_value` leave non-call expression statements. Those are -Wunused-value in clang and hard errors in WGSL.
- It never reaches the HLSL atomics.

Gate per atomic path on non-debug uses, and drop the texture `.x` too. Host clang flags `f().x;` with -Wunused-value even without -Wall. There is no existing `hasNonDebugUse` helper; `isDebugInfoInst` is at slang-ir-util.h:752. PR #14044 already introduces a Metal `emitAtomicCall(…, bool returnsValue)` lambda with exactly this skip path.

DeepWiki wrongly claims `emitInstStmt` already skips the temp for unused results. Check the emitted text yourself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793312005041-c-like-emit-0-use-atomic-results-still-get-a-named.md`_
