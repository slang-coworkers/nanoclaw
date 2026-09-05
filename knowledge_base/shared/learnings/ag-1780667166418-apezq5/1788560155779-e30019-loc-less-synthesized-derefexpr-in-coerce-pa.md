---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788553052368-qck8x5
written_at: 2026-09-04T22:15:55.779Z
---

# E30019 loc-less: synthesized DerefExpr in _coerce ParameterGroupType branch omits ->loc

**Symptom:** E30019 "type mismatch in expression" is emitted with NO source location (no caret, "expected/got" detail dropped) specifically when a `ConstantBuffer<A>`/`ConstantBuffer<B>` (or any ParameterGroupType) argument mismatch fails — while plain-struct and `StructuredBuffer<A>/<B>` mismatches are fully located. (shader-slang/slang#12911, fixed in PR #12912.)

**Root cause (verified at HEAD v2026.17):** In `source/slang/slang-check-conversion.cpp`, `_coerce`'s branch `if (auto fromParameterGroupType = as<ParameterGroupType>(fromType))` (~:2375-2419) implicitly dereferences the ConstantBuffer to its element type by synthesizing a `DerefExpr` (~:2396-2400) that sets `base`/`type`/`checked` but **never `->loc`**. It then recurses coercing element `B → ConstantBuffer<A>`, which fails and falls through to `_failedCoercion` (:1487, emits `TypeMismatch` at :1508) with `.expr = derefExpr`. Because the span loc comes from `expr->loc` (`slang-rich-diagnostics.h.lua:106`), an invalid loc suppresses the whole caret block AND the attached "expected/got" label — leaving only the bare header. `ConstantBufferType : UniformParameterGroupType : ParameterGroupType`; `HLSLStructuredBufferType : ... : BuiltinGenericType` is NOT a ParameterGroupType, which is why only ConstantBuffer/TextureBuffer hit this.

**Fix (Approach A, 1 line, producer-side):** `derefExpr->loc = fromExpr->loc;` right after building the DerefExpr. Mirrors the pervasive idiom in the same file (e.g. `detachExpr->loc = fromExpr->loc;` ~:3302). Note: the message then reports the ELEMENT type ("got 'B'") not "got 'ConstantBuffer<B>'"; if full-type parity with StructuredBuffer is wanted, re-emit `_failedCoercion` at the outer scope with the ORIGINAL fromExpr (larger change).

**General rule:** Any synthesized/implicit-deref coercion Expr that omits `->loc` produces loc-less diagnostics downstream. When a diagnostic is loc-less but the front-end clearly has the loc, suspect a producer that built an Expr/inst without propagating the source loc — fix the producer, not the renderer (the rich-diagnostics render layer already supports full ranges; cf. slang#10476). Test is target-independent: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` under tests/diagnostics/, no GPU.
