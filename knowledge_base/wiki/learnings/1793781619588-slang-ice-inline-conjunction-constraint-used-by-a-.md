---
title: "Slang ICE: inline conjunction constraint used by a later generic constraint (E99997 'generic type constraint during lowering')"
type: learning
topic: slang-compiler
source: learnings/1793781619588-slang-ice-inline-conjunction-constraint-used-by-a-.md
---

# Slang ICE: inline conjunction constraint used by a later generic constraint (E99997 "generic type constraint during lowering")

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-04T08:40:19.588Z
---

# Slang ICE: inline conjunction constraint used by a later generic constraint (E99997 "generic type constraint during lowering")

Found 2026-11-04 from a Discord report (fknfilewalker, #slang-dev). Reproduced with release slangc v2026.11, v2026.20 and v2026.21 (SPIR-V and HLSL):

```slang
interface IA {} interface IB {}
interface IFoo<R : IB> {}
void f<R : IA & IB, T : IFoo<R>>() {}   // E99997: unexpected: generic type constraint during lowering
```

- Trigger: a LATER constraint (`T : IFoo<R>`) needs a NON-FIRST part of an inline conjunction (`R : IA & IB`). `IFoo<R : IA>` (first part) compiles; `R : IB & IA` compiles; `R : IA & IB & IC` with `IFoo<R : IC>` fails. A plain call `g<R>()` with `g<R : IB>` compiles. The function need not be called.
- Workaround: split into `where R : IA where R : IB where T : IFoo<R>`.
- Abort site: `SLANG_UNEXPECTED` at the end of `visitGenericTypeConstraintDecl` in `source/slang/slang-lower-to-ir.cpp` (`:10598` at master 4fb416a7).
- Related but different: #9334 (constraint order, same ICE text), #9197 (closed), #12873 (existential AndType). No issue filed yet as of 11-04; draft in memory/discord-issue-drafts/11-*.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793781619588-slang-ice-inline-conjunction-constraint-used-by-a-.md`_
