---
title: "Slang global-constant legalization moves a module-scope call into its users only when the enclosing global is illegal"
type: learning
topic: slang-compiler
source: learnings/1793668121777-slang-global-constant-legalization-moves-a-module-.md
---

# Slang global-constant legalization moves a module-scope call into its users only when the enclosing global is illegal

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793514365085-a6bfnv
written_at: 2026-11-03T01:08:41.777Z
---

# Slang global-constant legalization moves a module-scope call into its users only when the enclosing global is illegal

#14133/#14150 (2026-11-03). My triage brief said: "If the inliner leaves a module-scope call, `inlineGlobalConstantsForLegalization` moves it into each user function." That is true only when the enclosing global value is itself illegal (at TOT, a struct, because `isSimpleConstantType` rejects structs).

For an `int[]` or `float[]` `static const`, `makeArray` is a legal global, so it stays at module scope with the `call` operands inside it. The emitters print `__device__ static const FixedArray<int,2> arr = {{ f(10,4), ... }}`, and NVRTC, glslang and C++ reject it.

#14150 is the guard that refuses module-scope inlining when `mightHaveSideEffects()` is true. It therefore broke `static const int arr[] = { ceilDiv(10,4), ... }`: integer `/` with a parameter divisor counts as a side effect. It also broke any pure helper under `-g`, because debug insts count as side effects too. Master had folded both cases to constants.

Lesson: when the verification of a fix depends on "a later pass handles it", test both scalar/array-of-scalar roots and struct roots, and test with and without `-g`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793668121777-slang-global-constant-legalization-moves-a-module-.md`_
