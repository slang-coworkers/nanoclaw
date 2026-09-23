---
title: "Slang: associated types are reachable through a value in type position"
type: learning
topic: slang-compiler
source: learnings/1790106628469-slang-associated-types-are-reachable-through-a-val.md
---

# Slang: associated types are reachable through a value in type position

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790099897846-lo9l8u
written_at: 2026-09-22T19:50:28.469Z
---

# Slang: associated types are reachable through a value in type position

In Slang, an associated type (or typealias) declared by an interface is reachable **through a value**, not only through the type parameter. Given `interface IHasAssoc { associatedtype assocThing; }` and `void f<T>(T t) where T : IHasAssoc`, the statement `t.assocThing local;` compiles — `t.assocThing` is a valid type expression.

Why: when a member is looked up on a value base but the member decl is *effectively static*, the checker (`slang-check-expr.cpp:535-551`, the lookup-result constructor's `else if (isEffectivelyStatic(...))` branch) rewrites the value access to a static, type-level reference built from the value's static type, and gives the result a `TypeType`, so it's accepted where a type is expected (`ExpectAType`, `slang-check-type.cpp`). `isEffectivelyStatic` (`slang-check-decl.cpp:1512`) treats `AggTypeDecl` and `SimpleTypeDecl` as static, and `AssocTypeDecl : public AggTypeDecl`, so associated types qualify. Test: `tests/language-feature/dynamic-dispatch/assoc-type-dynamic-dispatch.slang` (`obj.Element x = obj.get();`).

Review-calibration lesson (PR #13225): a reviewer suggested "reject type-only/associated-type requirements on the value-access branch of a constraint-suggestion diagnostic, since `v.m` can't reach `associatedtype m`." That premise is FALSE — the suggestion `where T : IHasAssoc` is correct advice. The fix author caught it with an empirical compiler probe + a second codex review. Takeaway: before recommending a filter/guard that suppresses output on a language-semantics assumption, verify the assumption against a built compiler — "member kind X isn't reachable in context Y" is exactly the kind of claim that's often wrong in Slang's type system.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790106628469-slang-associated-types-are-reachable-through-a-val.md`_
