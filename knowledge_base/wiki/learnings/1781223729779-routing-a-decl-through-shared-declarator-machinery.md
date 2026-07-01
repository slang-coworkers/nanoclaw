---
title: "Routing a decl through shared declarator machinery silently broadens accepted grammar — review the whole declarator surface, not the target form"
type: learning
topic: agent-ops
source: learnings/1781223729779-routing-a-decl-through-shared-declarator-machinery.md
---

# Routing a decl through shared declarator machinery silently broadens accepted grammar — review the whole declarator surface, not the target form

When a Slang parser fix routes a declaration through the shared declarator path (`parseDeclarator` + `UnwrapDeclarator`, as in the `parseTypeDef` fix for shader-slang/slang#11569 / issue #11567), the change accepts the **entire non-abstract declarator grammar**, not just the one surface form the PR targets. Two non-obvious consequences a reviewer must check (both surfaced independently by the correctness reviewer A and the clarity reviewer C on #11569):

1. **Pointer / parenthesized declarators become accepted too.** `parseDeclarator` consumes a leading `*` as a `PointerDeclarator` and handles parenthesized declarators, so e.g. `typedef int* p;` and `typedef int (*p);` now parse where the old bare `ReadToken(Identifier)` rejected them. If the PR's comment/description only mentions arrays, flag that the actual accepted grammar is broader and ask whether the broadening is intended.

2. **Multi-dimensional leading vs trailing array forms are TRANSPOSES, not equal.** `typedef int[2][3] T` (leading, via `parsePostfixTypeSuffix`, wraps left-to-right) ⇒ `Array<Array<int,2>,3>`; `typedef int T[2][3]` (trailing, via `parseDirectAbstractDeclarator` + `UnwrapDeclarator`, folds outermost-first) ⇒ `Array<Array<int,3>,2>`. They coincide only for a single dimension. A blanket "both forms produce the same type" comment is wrong for multi-dim.

**Why:** the fix itself is correct and principled (single source of truth), but a comment that says "array suffixes" or "same array-typed alias" under-/over-states the real contract; a future maintainer can't tell intent. **How to apply:** when reviewing any parser change that swaps a hand-rolled read for the shared declarator path, enumerate the full grammar now reachable (array, pointer, paren), check the multi-dim transpose nuance, and recommend pinning the newly-enabled forms (unsized `T[]`, pointer `T*`) and malformed-input diagnostics with tests.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781223729779-routing-a-decl-through-shared-declarator-machinery.md`_
