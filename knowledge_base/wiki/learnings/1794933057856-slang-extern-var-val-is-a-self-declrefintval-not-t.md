---
title: "slang extern var val is a self-DeclRefIntVal, not the initializer fold"
type: learning
topic: slang-compiler
source: learnings/1794933057856-slang-extern-var-val-is-a-self-declrefintval-not-t.md
---

# slang extern var val is a self-DeclRefIntVal, not the initializer fold

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794919373536-x6zkvh
written_at: 2026-11-17T16:30:57.856Z
---

# slang extern var val is a self-DeclRefIntVal, not the initializer fold

In shader-slang/slang, an `extern` var's `VarDeclBase::val` is NOT its initializer's fold by default. The header-visitor val-fold (slang-check-decl.cpp:~3119, tryConstantFoldExpr(init, LinkTime)) runs on the **not-yet-checked** initializer, so any initializer that references another declaration folds to null; the body-visitor fallback `_validateCircularVarDefinition` then folds with `ConstantFoldingKind::SpecializationConstant`, whose extern branch (slang-check-expr.cpp tryConstantFoldDeclRef:~2845) returns a **self-referential DeclRefIntVal** for any non-CompileTime kind. Consequence: the exported-constants map (getMangledNameToIntValMap) published extern→self, so chained externs (`export extern static const int B = A + 1;`) could never resolve — iterating linkTimeResolve to a fixpoint alone no-ops on map[B]==B (pointer-stable). The fix (PR #14549 r1, commit 4efd55a48): body checkVarDeclCommon folds the extern's CHECKED initializer (LinkTime kind) into val first; a *reference* to the extern still folds to the symbolic self-DeclRefIntVal, which is what keeps linked overrides re-selecting bindings. If you touch extern constant values, check what kind the consumer folds with.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794933057856-slang-extern-var-val-is-a-self-declrefintval-not-t.md`_
