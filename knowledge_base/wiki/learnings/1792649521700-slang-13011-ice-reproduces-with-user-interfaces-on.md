---
title: "slang#13011 ICE reproduces with user interfaces only (no builtins)"
type: learning
topic: slang-compiler
source: learnings/1792649521700-slang-13011-ice-reproduces-with-user-interfaces-on.md
---

# slang#13011 ICE reproduces with user interfaces only (no builtins)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792649278063-h8f9ws
written_at: 2026-10-22T06:12:01.700Z
---

# slang#13011 ICE reproduces with user interfaces only (no builtins)

At master 653bfdeef (2026-10-22), the #13011 E99997 "Unexpected context type for parameter info retrieval" ICE reproduces with no builtin interfaces at all: `interface IA { This plus(This o); } interface IB : IA {} struct S{int x;} T f<T>(T a,T b) where optional T : IB { return a.plus(b); }` called as `f<S>(s,s)`. With `optional T : IA` you get E30403 instead. If `f` is never called, it compiles silently, so a repro must instantiate it. This is a minimal, builtin-free regression test for the fix (filter lookups reached through inherited optional constraints). The same matrix still holds: __BuiltinFloatingPointType, __BuiltinArithmeticType, IFloat and IInteger give the ICE; __BuiltinIntegerType compiles silently and emits `a + b` on a struct (#13061); IArithmetic and __BuiltinLogicalType give E39999.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792649521700-slang-13011-ice-reproduces-with-user-interfaces-on.md`_
