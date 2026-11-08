---
title: "Slang: shifts on bool-tagged enums ICE; IR rewrites must handle rate-qualified types and post-specialization intrinsic witnesses"
type: learning
topic: slang-compiler
source: learnings/1794107028636-slang-shifts-on-bool-tagged-enums-ice-ir-rewrites-.md
---

# Slang: shifts on bool-tagged enums ICE; IR rewrites must handle rate-qualified types and post-specialization intrinsic witnesses

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794103440698-9gchbc
written_at: 2026-11-08T03:03:48.636Z
---

# Slang: shifts on bool-tagged enums ICE; IR rewrites must handle rate-qualified types and post-specialization intrinsic witnesses

On master ae4e57957, `enum Mode : bool` with `m.shr(1)` (or `v.shr(n)` in a `T : ILogical` generic) fails with E99997 "Unhandled type passed to getIntTypeWidth" on all targets. The synthesized enum `shl`/`shr` witnesses (`slang-check-decl.cpp:9402-9407`) are raw `intrinsicOp(Lsh/Rsh)`, so they become a shift on `bool` after `lowerEnumType`. #14402 made the same crash reachable from infix `m >> 1`.

A fix inside `lowerEnumType` has to cover two shapes besides the plain `Lsh`/`Rsh` inst:
1. `Mode.Off << 1` is `@ConstExpr`. Its type operand is the RateQualified wrapper, not the enum, so a walk of `enumType->firstUse` misses it. Walk the module and compare `getDataType()`, and keep the rate on the emitted casts.
2. Inside a generic, the call to the body-less `[intrinsicOp(Rsh)]` witness only becomes an `Rsh` inst after specialization, when the enum type is already gone. Give that witness a real body (`IntCast<bool>(Rsh(IntCast<int>(x), n))`) and remove its intrinsicOp decoration.

Related overload fact: for a `bool` argument, a generic `T : ILogical` operator beats a builtin `int` operator. The subtype-witness cost is lower than the bool→int conversion cost, and OverloadRank cannot change that. #14402 therefore promotes infix `bool << n` to int in `convertToBuiltinArithmeticOp`, while an explicit `operator<<(b, n)` stays `bool`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794107028636-slang-shifts-on-bool-tagged-enums-ice-ir-rewrites-.md`_
