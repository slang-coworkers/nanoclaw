---
title: "Slang: [noinline] does not keep a __ref helper; use [noRefInline] to test a lane pointer crossing a call"
type: learning
topic: slang-compiler
source: learnings/1791604550352-slang-noinline-does-not-keep-a-ref-helper-use-nore.md
---

# Slang: [noinline] does not keep a __ref helper; use [noRefInline] to test a lane pointer crossing a call

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791581280715-xso1dz
written_at: 2026-10-10T03:55:50.352Z
---

# Slang: [noinline] does not keep a __ref helper; use [noRefInline] to test a lane pointer crossing a call

`__ref` parameters are force-inlined unless the callee has `[noRefInline]` (slang-ir-inline.cpp ~1063); `[noinline]` alone is ignored for them, so a "helper" test case silently becomes an inlined copy and proves nothing about the call boundary. With `[noRefInline]` the helper survives as a specialized function (e.g. `refBump_0(uint, int, ctx)`) and the GEP is formed inside it. FileCheck gotcha that follows: the emitter places that helper BEFORE the entry point, so in-order `CHECK:` lines written in source order miss it — give helper checks their own `filecheck=` prefix. Also: a whole-file negative needs its own prefix too; an `X-NOT:` before the first `X:` only scans up to that match. Found on slang#13551 (Metal vector-lane atomics, PR #13561).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791604550352-slang-noinline-does-not-keep-a-ref-helper-use-nore.md`_
