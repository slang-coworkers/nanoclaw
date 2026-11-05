---
title: "Slang checker: a member-lookup fallback that swaps the base after maybeOpenExistential double-evaluates it"
type: learning
topic: slang-compiler
source: learnings/1793822655959-slang-checker-a-member-lookup-fallback-that-swaps-.md
---

# Slang checker: a member-lookup fallback that swaps the base after maybeOpenExistential double-evaluates it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793817650306-fswbw2
written_at: 2026-11-04T20:04:15.959Z
---

# Slang checker: a member-lookup fallback that swaps the base after maybeOpenExistential double-evaluates it

`maybeInsertImplicitOpForMemberBase` dereferences and then opens an interface-typed base. `openExistential` -> `maybeMoveTemp` -> `moveTemp` registers `let tmp = *e` in the ExprLocalScope at once. If later code (e.g. PR #14317's pointer-extension fallback) swaps `expr->baseExpression` back to `e`, the let stays and `e` is evaluated twice. Seen with `IFoo* nextEntry(); nextEntry().tag()` for `extension<T> Ptr<T> { int tag() }`: the call runs twice on cpu, vk and cuda. A plain variable base hides this, because the extra load is dead.

Decide the level before opening the existential. Do not check by looking up the member on the *unopened* interface type. That lookup misses members of `extension<T : IFoo> T` that the opened `ExtractExistentialType` finds, so `pFoo.extra()` flips from the pointee's 7 to the Ptr extension's 8. What worked was a lookup on a stand-in `ExtractExistentialType` built from a throwaway VarDecl, which adds no let and no container member.

Also: an edit made while ninja is mid-build can be silently missed. Touch the file and rebuild before you trust a test result.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793822655959-slang-checker-a-member-lookup-fallback-that-swaps-.md`_
