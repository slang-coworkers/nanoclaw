---
title: "Synthesized struct storage added after ctor-signature collection needs its own initExpr"
type: learning
topic: misc
source: learnings/1782847970010-synthesized-struct-storage-added-after-ctor-signat.md
---

# Synthesized struct storage added after ctor-signature collection needs its own initExpr

From slang#11844 (PR #11848). When the front-end synthesizes a hidden storage member AFTER the constructor signature has been collected — e.g. the bitfield backing word `$bit_field_backing_N` created in `SemanticsDeclAttributesVisitor::visitStructDecl`'s bit-packing lambda, inserted after `collectInitializableMembers` already populated `m_membersVisibleInCtor` — that member is never a ctor parameter, so the synthesized ctor body (`synthesizeCtorBodyForMemberVar`, slang-check-decl.cpp:~14000) early-outs `if(!varDeclBase->initExpr) return;` and NEVER writes it. Result for a struct mixing bitfields with a trailing normal field: `Foo f = {}` leaves the backing word uninitialized (garbage) + warning E41021. Fix = give the synthesized member an explicit zero `initExpr` at creation (producer-side). It stays out of `m_membersVisibleInCtor` so no ctor-param leak; the body then stores `backing = 0`.

Two non-obvious facts this hinges on:
1. The general per-member default-init loop in `SemanticsDeclBodyVisitor::visitAggTypeDecl` (~14132-14138, `constructDefaultInitExprForType`) is GATED on the struct conforming to `IDefaultInitializable`. Bitfield structs — AND even a plain all-normal `struct{uint a;uint b;uint c;}` — do NOT conform (probe `T zero<T:IDefaultInitializable>(){T t; return t;}` → E38029). So that loop is NOT the `{}` mechanism for these; `{}` uses the synthesized member-wise/default ctor. Don't assume the general default-init path covers synthesized members.
2. `constructDefaultInitExprForType`→`DefaultConstructExpr` lowers to `= {}` ONLY for CPP/CUDA (`_emitInstAsDefaultInitializedVar`, slang-emit-c-like.cpp:3490-3498); it would NOT zero a scalar on HLSL-class targets. A raw `IntegerLiteralExpr(0)` (→ `IRStore(backing,0)` on every target) is the backend-robust choice for zeroing a scalar — prefer it over the helper here.

Testing: the runtime `-cpu` value test for an uninitialized-read bug is NOT a reliable fails-on-master gate (fresh stack is often already zero, and `init-local-var` won't re-zero a ctor-initialized var). Use a deterministic gate instead: an emit-level `SIMPLE(filecheck=CHECK):-target hlsl` test asserting the backing store (`CHECK: ...bit_field_backing... = ...0`), and/or a `DIAGNOSTIC_TEST` on the warning. Both are deterministic and need no GPU.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782847970010-synthesized-struct-storage-added-after-ctor-signat.md`_
