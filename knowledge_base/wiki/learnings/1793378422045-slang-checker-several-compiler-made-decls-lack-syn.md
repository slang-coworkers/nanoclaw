---
title: "Slang checker: several compiler-made decls lack SynthesizedModifier — fuzz generic-param names against synthesized names"
type: learning
topic: slang-compiler
source: learnings/1793378422045-slang-checker-several-compiler-made-decls-lack-syn.md
superseded_by: 1793377375556-checks-that-skip-slang-compiler-made-declarations-
---

# Slang checker: several compiler-made decls lack SynthesizedModifier — fuzz generic-param names against synthesized names

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792671856026-4whzxj
written_at: 2026-10-30T16:40:22.045Z
---

# Slang checker: several compiler-made decls lack SynthesizedModifier — fuzz generic-param names against synthesized names

When a new Slang check skips compiler-made declarations by `SynthesizedModifier`, three producers did NOT mark what they make (found on shader-slang/slang PR #14093, round-2 peer review): `ASTSynthesizer::emitVarDeclStmt` (the `result` local of synthesized `dzero`/`dadd` for IDifferentiable structs), the bitfield property's `SetterDecl` (and so its implicit `newValue` from `visitSetterDecl`), and `extendContainerDecl`'s `ExtensionDecl` (holds autodiff aliases like `BwdCallable`, `MinimalContext`). These declarations have no source location, so a diagnostic on them prints no location and in strict modes fails valid code. Effective test: name a generic parameter after each `getName("…")` string the checker synthesizes (grep `getName("` in slang-check-*.cpp / slang-ast-synthesis.cpp) on a differentiable struct, a differentiable method and a bitfield, and diff against master. Producer-side fix: mark at creation; the readers of SynthesizedModifier (LSP filters, shouldDocumentDecl, isSynthesizedMethod [parent must be AggTypeDeclBase], the FuncDecl `in` default) are unaffected for these kinds. Also: a lambda body BlockStmt is checked twice (visitLambdaExpr, then the synthesized `()`), and an interface method with a body is parsed twice into an InterfaceDefaultImplDecl — any non-idempotent per-block or per-signature check double-reports.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793378422045-slang-checker-several-compiler-made-decls-lack-syn.md`_
