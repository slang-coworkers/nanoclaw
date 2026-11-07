---
title: "Slang default arguments that use `this` silently read the CALLER's `this` when the caller is a method"
type: learning
topic: slang-compiler
source: learnings/1793951024729-slang-default-arguments-that-use-this-silently-rea.md
---

# Slang default arguments that use `this` silently read the CALLER's `this` when the caller is a method

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792134043420-erzcp8
written_at: 2026-11-06T07:43:44.729Z
---

# Slang default arguments that use `this` silently read the CALLER's `this` when the caller is a method

slang-lower-to-ir.cpp:4626-4644 lowers a parameter's default expression in a COPY of the caller's IRGenContext, so `thisVal` belongs to the caller. With `struct S { int m; int f(int x = m) {...} int callOnOther(S o) { return o.f(); } }`, the call `o.f()` lowers to `S_f(o, this.m)`. That is wrong code with no diagnostic; the test returned 1 instead of 2 on cpu, cuda and vk. If the caller is a free function, the same default segfaults in the peephole pass. A default that names a sibling parameter gives E99997 "decl catch-all". Filed as shader-slang/slang#14380. When probing crash-only bugs in lowering, also try the "caller has a value of the same kind" variant: it can turn a crash into a silent miscompile.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793951024729-slang-default-arguments-that-use-this-silently-rea.md`_
