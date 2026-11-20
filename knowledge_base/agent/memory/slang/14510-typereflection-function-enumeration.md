---
type: chain
title: slang#14510 — TypeReflection function enumeration (feature, maintainer-gated)
description: Falcor-partner feature ask for enumerating type functions / interface requirements on TypeReflection. Parked for maintainer direction since 2026-11-16; no fixer until the API surface is approved.
tags: [reflection-api, feature-request, c-abi, maintainer-gated, parked]
---

# slang#14510 — enumerate functions on `TypeReflection`

**Feature request, parked for maintainer direction.** Filed 2026-11-16 by ccummingsNV (Falcor/NVIDIA
partner). No labels/assignees at filing. I dispatched the triager at once (human-filed, no waiting
period); triager session `sess-1794859522154-3yke7p` owns `gh-issue-shader-slang/slang-14510`.

**The ask (in preference order):** (1) enumerate functions on `TypeReflection` —
`function_count`/`get_function_by_index` or `type.functions` — returning `FunctionReflection`s with
user attributes intact, covering struct member functions (static+instance) and interface
requirements incl. default bodies, with the inherited-members policy documented or selectable.
(2) Failing that, a type→declaration mapping (`type.decl` → `DeclReflection`). Falcor2's current
workaround walks `module_decl.children` breadth-first across all source modules (slow, fragile,
two lookups per method).

**Triage verdict (2026-11-16):** confirmed gap, P2 normal, not a duplicate. `TypeReflection` has
count/by-index pairs only for fields; the sole function route is name-based
(`spReflection_FindFunctionByNameInType`). Recommended approach **A**: append-only
`get_function_count`/`get_function_by_index` next to the field pair (slang-reflection-api.cpp:553-612
is the pattern), reusing `getMembersOfType<FunctionDeclBase>`; known pitfalls: GenericDecl unwrap,
`isInterfaceRequirement` filter, exclude `InterfaceDefaultImplDecl` stubs. Approach B (5-line
type→DeclReflection bridge) is smaller but keeps the second lookup and leaks AST rough edges.
**Open design call:** inherited-members policy (documented direct-only vs InheritanceInfo-facet
recursion) — the issue itself asks for documented-or-selectable.

**Park rationale:** new public API surface + inherited-members semantics are maintainer calls; the
append-only shape fits the C-ABI pattern, but API-shape proposals have PARK precedent. The triager
posted the 5-bullet on the issue (comment 6927906819), set Issue Type to Feature, and armed one-shot
re-check `i14510-recheck-5254` (fires 2026-11-30); triager-side artifacts: memory/issues/triage-14510.md
(memo) and memory/issues/14510.md (chain state). **No fixer dispatch until a maintainer approves the
surface.** Reopens on explicit maintainer sign-off on the issue, or if the operator directs otherwise.
