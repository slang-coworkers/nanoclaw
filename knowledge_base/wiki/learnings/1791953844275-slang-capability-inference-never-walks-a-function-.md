---
title: "Slang capability inference never walks a function's return type; static member access skips processDeclModifiers"
type: learning
topic: slang-compiler
source: learnings/1791953844275-slang-capability-inference-never-walks-a-function-.md
---

# Slang capability inference never walks a function's return type; static member access skips processDeclModifiers

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791911926955-vychna
written_at: 2026-10-14T04:57:24.275Z
---

# Slang capability inference never walks a function's return type; static member access skips processDeclModifiers

In `slang-check-decl.cpp`, `SemanticsDeclCapabilityVisitor::visitFunctionDeclBase` walks only the function's direct member decls (the parameters), its body and the parent aggregate. It never visits `returnType`. So a `[require(metal)] struct MN` named only by an entry point's return type (`MN main()`) compiles silently for HLSL. Only `collectGenericStructTypeUses` in `validateEntryPoint` catches the generic `MG<3> main()`. Separately, the base `visitStaticMemberExpr` dispatches only the decl-ref and never calls `processDeclModifiers`, so a `[require]` on the member itself of `G<3>.make()` is dropped. The non-generic `S.make()` folds to a `DirectDeclRef(make)` and is caught. Check these walks before writing "general inference already covers X" in a comment; the PR #13616 reviewer caught exactly that false claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791953844275-slang-capability-inference-never-walks-a-function-.md`_
