---
title: "Slang unannotated ref accessor mutability — four decision sites + gotchas"
type: learning
topic: slang-compiler
source: learnings/1789629621707-slang-unannotated-ref-accessor-mutability-four-dec.md
---

# Slang unannotated ref accessor mutability — four decision sites + gotchas

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786484172954-01b3wv
written_at: 2026-09-17T07:20:21.707Z
---

# Slang unannotated ref accessor mutability — four decision sites + gotchas

From shader-slang/slang#12487 / #9636 (PR #12492). An unannotated `ref` property/subscript accessor is implicitly mutating, exactly like `set` (maintainer-directed "Option A", with `[nonmutating]` opt-out). Mutability is decided at **FOUR independent sites**, ALL of which must recognize `RefAccessorDecl && !NonmutatingAttribute && !ConstRefAttribute`:

1. `isEffectivelyMutating` (slang-check-overload.cpp) — whether the *caller* needs a mutable base.
2. `getDeclaredParamPassingModeForImplicitThisParam` (slang-lower-to-ir.cpp) — passes `this` as `BorrowInOut`.
3. `visitThisExpr` (slang-check-expr.cpp) — l-value of an **explicit** `this.field = …` write in the accessor body.
4. The implicit-`this` breadcrumb ladder inside **`_lookUpInScopes`** (slang-lookup.cpp), in the `FunctionDeclBase` branch — l-value of an **unqualified** `field = …` write in the body.

Key traps:
- Sites 3 and 4 are **separate paths**: explicit `this.x` vs implicit unqualified `x`. Fixing only `visitThisExpr` leaves the implicit unqualified member write failing E30049 ("assign to immutable member"). The implicit path does NOT go through `visitThisExpr`.
- The site-4 function is `_lookUpInScopes`, NOT `_computeLookupResult` (a common mis-naming — verify with grep).
- The immutable-`this` accessor annotations are BOTH `[nonmutating]` (by-value `this`) AND `[constref]` (const-reference `this`; `ConstRefAttribute` → `BorrowIn` at lowering, slang-lower-to-ir.cpp:~3858). Exclude both. `[constref]` is the *attribute* spelling that reaches accessors (also via interface-requirement synthesis); `__constref` is a SEPARATE `BorrowModifier` that is REJECTED on accessors (E31201 "modifier not allowed here"). `isEffectivelyMutating` itself does NOT check ConstRefAttribute (latent gap).
- A self-recursive `ref` accessor is rejected by **E55201 "recursion not allowed"** (slang-diagnostics.lua) BEFORE the type-based inliner runs. So a "recursive Generic-address-space pointer return never finishes inlining" guard in slang-ir-inline.cpp (e.g. an `isDirectlyRecursive` bail) is UNREACHABLE dead code for accessor scenarios — don't add it (no-speculative-guards rule).

Git gotcha that cost a wasted 20-min rebuild: to discard an *uncommitted* working-tree change on a PR branch, use `git checkout HEAD -- <file>`, NOT `git checkout master -- <file>`. The latter reverts the file to master, nuking the branch's OWN committed changes vs master (here it removed the round-1 Generic-pointer force-inline in slang-ir-inline.cpp that the ref-accessor lowering depends on, silently breaking ref-accessor-targets.slang). Restore to HEAD.

DIAGNOSTIC_TEST(diag=CHECK) is exhaustive: when a diagnostic's primary and span messages are made identical (compact house style), it emits ONE annotation per site, so keep ONE `//CHECK` per caret (a duplicate second CHECK line fails with "already matched"). The harness prints copy-pasteable caret-aligned suggestions on failure — use them.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789629621707-slang-unannotated-ref-accessor-mutability-four-dec.md`_
