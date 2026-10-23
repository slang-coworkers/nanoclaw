---
title: "Slang: ensureDecl skipped ReadyForReference for inferred-type decls; cbuffer members need a scope pass (#13876)"
type: learning
topic: slang-compiler
source: learnings/1792703651539-slang-ensuredecl-skipped-readyforreference-for-inf.md
---

# Slang: ensureDecl skipped ReadyForReference for inferred-type decls; cbuffer members need a scope pass (#13876)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-22T21:14:11.539Z
---

# Slang: ensureDecl skipped ReadyForReference for inferred-type decls; cbuffer members need a scope pass (#13876)

Verified at shader-slang/slang e485e7861 (draft PR #13880).

- A var without a type expression jumps from SignatureChecked to DefinitionChecked (deriveVarTypeFromInitExpr / checkVarDeclCommon). ensureDecl therefore never ran the ReadyForReference step, where the redeclaration check lives. Untyped `let`/`var`, unsized arrays with an initializer, and `[UnscopedEnum]` case aliases (untyped static const LetDecls) were only diagnosed when the typed declaration came second. The fix replays `_dispatchDeclCheckingVisitor(decl, ReadyForReference, ctx)` after a step jumps past it.
- Trap: replaying that step runs checkForRedeclaration on EVERY jumped decl. The parentless `__optInner` VarDecl that `_coerce` creates for Optional<T>→Optional<U> was left Unchecked; the capability pass's ensureDecl then aborted with "decl has no parent" in 7 Optional tests. The producer fix sets `checkState = DefinitionChecked`, as moveTemp does. Before adding any ensureDecl-level hook, grep `create<VarDecl>()` for parentless synthesized decls.
- cbuffer/tbuffer/GLSL-block members (no instance name) live in a struct marked ImplicitParameterGroupElementTypeModifier, followed by a `__transparent` var. Parser facts:
  - With `-Gec`, `__transparent` moves to a UniformParameterShadowVarDecl that comes after the renamed param.
  - A `gl_*` builtin block redeclaration keeps the marked struct but replaces the var with an EmptyDecl, so the marker alone does not mean the members are visible.
- What worked: one ordered pass per scope, run from the first transparent var. Filter with DeclPassesLookupMask(Default), so synthesized AttributeDecls (`struct XAttribute`) are not flagged. Leave decls that have an earlier same-name sibling to checkForRedeclaration, so no decl gets two errors.
- DXC 1.9 also rejects these shapes as hard errors. To check DXC without a dxc CLI, run `slangc -pass-through dxc -target dxil -profile cs_6_0`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792703651539-slang-ensuredecl-skipped-readyforreference-for-inf.md`_
