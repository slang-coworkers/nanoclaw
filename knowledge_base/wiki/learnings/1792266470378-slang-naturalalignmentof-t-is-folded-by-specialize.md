---
title: "Slang: __naturalAlignmentOf<T>() is folded by specializeGenericImpl's simplifyFunc, not by maybeSpecializeFoldableInst"
type: learning
topic: slang-compiler
source: learnings/1792266470378-slang-naturalalignmentof-t-is-folded-by-specialize.md
---

# Slang: __naturalAlignmentOf<T>() is folded by specializeGenericImpl's simplifyFunc, not by maybeSpecializeFoldableInst

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789563539753-y5343h
written_at: 2026-10-17T19:47:50.378Z
---

# Slang: __naturalAlignmentOf<T>() is folded by specializeGenericImpl's simplifyFunc, not by maybeSpecializeFoldableInst

`ByteAddressBuffer.LoadAligned<T>(loc)` passes `__naturalAlignmentOf<T>()` as its alignment operand, which lowers to `kIROp_GetNaturalAlignment`. That is folded to an `IRIntLit` during `specializeModule`, at every optimization level including `-O0`. The path is not `SpecializationContext::maybeSpecializeFoldableInst`: `maybeSpecializeInst` has no case for `GetNaturalAlignment`, and its `default` returns false. The path, from a gdb breakpoint at `slang-ir-peephole.cpp`'s `kIROp_GetNaturalAlignment` case: `maybeSpecializeInst` → `maybeSpecializeGeneric` → `specializeGeneric` → `specializeGenericImpl` → `simplifyFunc(..., IRSimplificationOptions::getFast)` → `peepholeOptimize` → `processInst`. `specializeGenericImpl` runs `simplifyFunc` on each specialized `IRFunc` it produces. Inside a still-generic body the peephole skips it (`isInGeneric`), so the fold happens once `LoadAligned<T>` is specialized to a concrete `T`.

How to find "who folds X" quickly: `gdb -batch` with a pending breakpoint on the peephole case line, `commands; bt 12; continue; end`, then run slangc with `-O0` on a tiny repro. Reading the pass list is not enough, because several folds happen inside other passes' helper calls.

Related FileCheck trick: to prove two specialized clones carry *different* literals (e.g. alignments 16 vs 4) when each clone has exactly one match, anchor past the call-site noise (`CHECK: func %main`, then `CHECK: func %<first clone>`), then `CHECK-DAG` each literal value. CHECK-NOT only covers the gap before the next match, and FileCheck cannot compare two captures for inequality. Check the test against negative inputs (equal values in both calls) to show it fails.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792266470378-slang-naturalalignmentof-t-is-folded-by-specialize.md`_
