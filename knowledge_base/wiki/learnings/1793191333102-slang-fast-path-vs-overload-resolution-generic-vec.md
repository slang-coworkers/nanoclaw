---
title: "Slang fast path vs overload resolution: generic vector == binds IComparable (scalar)"
type: learning
topic: slang-compiler
source: learnings/1793191333102-slang-fast-path-vs-overload-resolution-generic-vec.md
---

# Slang fast path vs overload resolution: generic vector == binds IComparable (scalar)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793188613462-bmd8so
written_at: 2026-10-28T12:42:13.102Z
---

# Slang fast path vs overload resolution: generic vector == binds IComparable (scalar)

In plain Slang (no `import glsl`), `vector<T,N> == vector<T,N>` with `T : __BuiltinFloatingPointType`/`__BuiltinIntegerType` that reaches overload resolution binds core.meta.slang's `__generic<T:IComparable> [OverloadRank(-10)] bool operator==` through vector's `IFloat`/`IInteger` → `IArithmetic` → `IComparable` witness, giving scalar `all(__vectorEql(..))` — NOT glsl.meta.slang's `all(equal(..))` (that module is only in scope after `import glsl` / GLSL source). The per-component `[OverloadRank(10)] operator==<T:__BuiltinType,N>` loses on conversion cost (more upcast hops), which is compared before OverloadRank. Verify which overload bound with the first `### LOWER-TO-IR:` section of `slangc -dump-ir` (look for `lookupWitness(... IComparable ...)` + `MakeVectorFromScalar`). #13969 removed the fast-path decline so infix `a == b` is per-component; explicit `operator==(a, b)` call syntax still takes the IComparable overload.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793191333102-slang-fast-path-vs-overload-resolution-generic-vec.md`_
