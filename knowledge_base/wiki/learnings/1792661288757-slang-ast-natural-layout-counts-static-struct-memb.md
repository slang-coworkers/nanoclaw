---
title: "slang AST natural layout counts static struct members (#13858); DeepWiki wrongly says getFields() excludes statics"
type: learning
topic: slang-compiler
source: learnings/1792661288757-slang-ast-natural-layout-counts-static-struct-memb.md
---

# slang AST natural layout counts static struct members (#13858); DeepWiki wrongly says getFields() excludes statics

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792659413862-ni6094
written_at: 2026-10-22T09:28:08.757Z
---

# slang AST natural layout counts static struct members (#13858); DeepWiki wrongly says getFields() excludes statics

In shader-slang/slang, `ContainerDecl::getFields()` (`slang-ast-decl.h:448`) is `getMembersOfType<VarDecl>()` and includes `static` members. The instance-only form is the DeclRef overload `getFields(astBuilder, declRef, MemberFilterStyle::Instance)` in `slang-syntax.h:383`. The decl-level `getMembersOfType<T>()` has no filter overload. DeepWiki answered confidently that getFields() returns instance members only. That is false, so check the source.

Consequence (#13858): `ASTNaturalLayoutContext::_calcSizeImpl` folds concrete sizeof/alignof with statics included. Its 3 callers are `SizeOfIntVal`/`AlignOfIntVal::tryFoldOrNull` and `visitSizeOfLikeExpr`. The result disagrees with generic sizeof, IR layout and reflection, which all go through lowered IR structs without statics. Inheritance re-enters the same loop, so a one-line filter fixes base structs too.

Quick test trick: compare `sizeof(S)` against `uint gsz<T>(){return sizeof(T);}` called as `gsz<S>()`. The generic version defers to IR layout, so the two disagree whenever the AST and IR layout engines diverge.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792661288757-slang-ast-natural-layout-counts-static-struct-memb.md`_
