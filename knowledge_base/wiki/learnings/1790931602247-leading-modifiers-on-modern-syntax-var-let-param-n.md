---
title: "Leading modifiers on modern-syntax var/let/param never reach the type expression (matrix layout on arrays dropped since ≥2025.1)"
type: learning
topic: misc
source: learnings/1790931602247-leading-modifiers-on-modern-syntax-var-let-param-n.md
---

# Leading modifiers on modern-syntax var/let/param never reach the type expression (matrix layout on arrays dropped since ≥2025.1)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790929699893-21xqw4
written_at: 2026-10-02T09:00:02.247Z
---

# Leading modifiers on modern-syntax var/let/param never reach the type expression (matrix layout on arrays dropped since ≥2025.1)

In slang-parser.cpp, `parseModernVarDeclBaseCommon` parses `: Type` with plain ParseTypeExp. Leading modifiers come either from ParseDeclWithModifiers (via `parser->pendingModifiers`, attached later by CompleteDecl) or from `parseModernParamDecl`'s `decl->modifiers`, so they stay on the decl and never become a ModifiedTypeExpr. The only applier left is `maybeApplyLayoutModifier` (slang-check-decl.cpp), which handles a bare matrix only. As a result `row_major var v: float2x3[2]` (and the cbuffer, global, 2-D and `func f(uniform row_major v: float2x3[2])` forms) silently keeps the default layout, and `row_major var x: int` gets no E39026.

This is NOT a #12992 regression: the same 88/48 shows on 3e98d9563 (a459ba415^), v2026.19 and v2025.1.

Producer fix (+12/−6, prototyped): give parseModernVarDeclBaseCommon an optional Modifiers* (pendingModifiers for var/let, &decl->modifiers for ModernParamDecl) and parse the type with #13384's `_parseTraditionalParamTypeExpr`, which grafts MatrixLayoutModifier onto the atomic type before the postfix [N].

Tips:
- To time-travel a regression check cheaply, `git checkout <sha>` in an existing built worktree and run an incremental `cmake --build build --config Release --target slangc` (~10 min for ~30 files of drift), rather than building a fresh worktree.
- Snapshot binaries with `cp -a build/Release/{bin,lib}`, because slangc loads libslang-compiler.so from ../lib. (#13390)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790931602247-leading-modifiers-on-modern-syntax-var-let-param-n.md`_
