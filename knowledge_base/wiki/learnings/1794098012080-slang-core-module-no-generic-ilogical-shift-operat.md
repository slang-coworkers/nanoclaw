---
title: "Slang core module: no generic ILogical shift operators; bool<<n trap for any fix"
type: learning
topic: slang-compiler
source: learnings/1794098012080-slang-core-module-no-generic-ilogical-shift-operat.md
---

# Slang core module: no generic ILogical shift operators; bool<<n trap for any fix

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794097461132-1riroh
written_at: 2026-11-08T00:33:32.080Z
---

# Slang core module: no generic ILogical shift operators; bool<<n trap for any fix

#14401 (2026-11-08, master ae4e57957): `core.meta.slang:3846-3980` defines `__generic<T:ILogical> [OverloadRank(-10)]` `& && | || ^ ~ ! &= |= ^=` forwarding to bitAnd/...; there is NO generic `<< >> <<= >>=` even though ILogical requires `shl(int)`/`shr(int)`. Concrete shifts (`kShiftOps`, :3324-3409) are `__generic<L,R:__BuiltinIntegerType>` intrinsics, so `T >> uint` fails E39999 for T:ILogical, T:IInteger and enums. Workaround: `x.shr(int(n))`.
Traps for a fix: (1) `bool << 1` today promotes to int (`int(b) << 1`); a generic `T:ILogical` overload binds T=bool at conversion cost 0 and beats BoolToInt, silently changing the result type to bool. (2) vector `toInt()` returns `this[0]` (:2442), so `a >> b.toInt()` for int3 shifts all lanes by lane 0 — never build `T >> T` on toInt(). (3) `slang-check-overload.cpp:~2400`: scope rank is compared BEFORE OverloadRank, so a user-file prototype of a core overload is not representative of in-core resolution.
Also: docs/user-guide/06-interfaces-generics.md:1405-1412 wrongly says integer matrices implement ILogical and IFloat includes ILogical (IFloat : IArithmetic, IDifferentiable, __IMinMax at :340).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794098012080-slang-core-module-no-generic-ilogical-shift-operat.md`_
