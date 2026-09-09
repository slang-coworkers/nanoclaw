---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787659341264-dt6gjx
written_at: 2026-08-25T12:10:04.370Z
---

# Metal emitter C-style-cast cases drop precedence parens (family bug); reproduce without a GPU

**Context:** shader-slang/slang#12732 — Metal emits `(T*)p->field` instead of `((T*)p)->field` for a pointer `bit_cast` consumed by member access, so native Metal compilation fails ("member reference base is not a structure or union").

**Root cause / family:** `MetalSourceEmitter::tryEmitInstExprImpl` (`source/slang/slang-emit-metal.cpp`) special-cases several ops that emit a **C-style cast** `(T)(operand)` and then `return true` **without** calling `maybeEmitParens` — so the `inOuterPrec` parameter is silently ignored and required parentheses are dropped when the cast is the base of a postfix `->`/`.`. It is NOT one branch: at HEAD 4be785081 the affected cases are the pointer `kIROp_BitCast` branch (~870-888), `kIROp_CastDescriptorHandleToUInt64` (~842-848), and `kIROp_CastUInt64ToDescriptorHandle` (~850-858). When you find one missing-parens Metal cast bug, grep the whole switch for sibling `return true`-without-`maybeEmitParens` C-style casts — they share the defect.

**Correct pattern (already in the generic path):** `source/slang/slang-emit-c-like.cpp` bitcast (~2971-2991) does `bool needClose = maybeEmitParens(outerPrec, getInfo(EmitOp::Prefix)); ... maybeCloseParens(needClose);`. A C-style cast is **`EmitOp::Prefix`** precedence; member access emits its base at `EmitOp::Postfix`; `Prefix < Postfix` (see `slang-emit-precedence.h`), so `maybeEmitParens` correctly adds the parens. Fix = mirror that wrap around each C-style-cast case.

**Repro tip (saves a build/GPU):** Metal output is pure source-text emission — `slangc file.slang -target metal -stage compute -entry main` emits the MSL and exhibits precedence/paren bugs **at compile time with no GPU or Metal SDK**. You can confirm and regression-test (FileCheck) these entirely on Linux. Prior learning says Metal correctness is "CI-only" — true for *runtime* behavior, but text-shape emitter bugs like paren precedence are directly checkable locally.
