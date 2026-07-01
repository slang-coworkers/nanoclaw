---
title: "Slang synthesized-member init: IDefaultInitializable loop is off for bitfield structs; raw literal beats DefaultConstruct for backend-robust zero"
type: learning
topic: slang-compiler
source: learnings/1782847433081-slang-synthesized-member-init-idefaultinitializabl.md
---

# Slang synthesized-member init: IDefaultInitializable loop is off for bitfield structs; raw literal beats DefaultConstruct for backend-robust zero

Discovered reviewing shader-slang/slang#11848 (zero-init bitfield backing word in synthesized ctor). Two non-obvious facts, both confirmed empirically (fixer probe on built slangc + correctness reviewer's emit trace):

**1. The general default-init loop in `slang-check-decl.cpp` (~14132-14138, `SemanticsDeclBodyVisitor::visitAggTypeDecl`) is gated on `isDefaultInitializableType` and is OFF for bitfield-containing structs.** It fills `initExpr = constructDefaultInitExprForType(...)` for every direct VarDeclBase member lacking one — BUT only if the struct conforms to `IDefaultInitializable`. A fixer probe of `T zero<T:IDefaultInitializable>(){T t;return t;}` showed `Mixed{a:10;b:22;c}`, `BitOnly{a:10;b:22}`, AND even all-normal `Normal{a;b;c}` are all rejected with E38029 (don't conform without explicit declaration). So that loop never fires for these structs — the `{}` path is the synthesized member-wise/default ctor, not the general loop. Consequence: to initialize a *synthesized* member (e.g. `$bit_field_backing_N`), set its `initExpr` at the producer (where it's synthesized, ~19602), NOT by relying on the general loop. `synthesizeCtorBodyForMemberVar` (~13975) early-outs at ~14000 (`if(!varDeclBase->initExpr) return;`) for non-param members, so a synthesized member with null initExpr is silently never assigned → uninitialized read. This is why producer-side initExpr is the correct layer.

**2. For a backend-robust zero on a synthesized member, use a raw typed `IntegerLiteralExpr(0)`, NOT `constructDefaultInitExprForType`/`DefaultConstruct`.** A clarity pass will suggest "reuse the helper" — but `DefaultConstruct`-based zero emits `= {}` ONLY for CPP/CUDA targets (`slang-emit-c-like.cpp:~3490-3498`), whereas `IntegerLiteralExpr(0)` lowers to `IRStore(backing, 0)` on every target. So the raw literal is *deliberately* the correct choice, not a convention violation — just document why (and that the backing type is always a builtin unsigned int). The RHS of a synthesized member-init assignment is consumed as-is (only the LHS member access is re-checked, ~14034), so it must be pre-typed: set `->type = QualType(...)`, `->value`, `->loc` — matches the enum-tag idiom at ~12414.

Reviewer-process note (reinforces a prior learning): Devin (Reviewer B) again exited rc=0 while still showing "Generating…"; a single re-fetch a few minutes later settled it to a real clean result. Always grep devin-flags.md for `Generating` before trusting "(none reported)".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782847433081-slang-synthesized-member-init-idefaultinitializabl.md`_
