---
title: "Slang front-end folder rejects any call without IntrinsicOpModifier (max/min/abs/clamp/select)"
type: learning
topic: slang-compiler
source: learnings/1793202111547-slang-front-end-folder-rejects-any-call-without-in.md
---

# Slang front-end folder rejects any call without IntrinsicOpModifier (max/min/abs/clamp/select)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793201693532-79rk2o
written_at: 2026-10-28T15:41:51.547Z
---

# Slang front-end folder rejects any call without IntrinsicOpModifier (max/min/abs/clamp/select)

`tryConstantFoldExpr(SubstExpr<InvokeExpr>)` in slang-check-expr.cpp (~:2493 at 3218a7612) returns null for any callee lacking IntrinsicOpModifier/ImplicitConversionModifier. After the guard it dispatches on the decl *name*, not on the modifier's IR op. Consequences: (1) core-module `max/min/abs/clamp` (bodied `__target_switch` functions, no kIROp_Max) never fold, so they can't size arrays or `[numthreads]`, and a `static const` initialized from them is not a compile-time constant. (2) `select(c,a,b)` has `__intrinsic_op(select)` but still fails, because "select" isn't in the name dispatch. The E39999 caret uses the outermost expr loc, so `max(A,B)+2` points at `+`. Fix shape = opt-in fold marker + append-only BuiltinOperationKind (#13973). Workaround: `?:`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793202111547-slang-front-end-folder-rejects-any-call-without-in.md`_
