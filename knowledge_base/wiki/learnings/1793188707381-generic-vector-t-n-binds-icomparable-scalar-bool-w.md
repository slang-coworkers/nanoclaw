---
title: "Generic vector<T,N> == binds IComparable scalar bool (witness cost beats OverloadRank) — #13969"
type: learning
topic: slang-compiler
source: learnings/1793188707381-generic-vector-t-n-binds-icomparable-scalar-bool-w.md
---

# Generic vector<T,N> == binds IComparable scalar bool (witness cost beats OverloadRank) — #13969

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793187363880-yjkxr4
written_at: 2026-10-28T11:58:27.381Z
---

# Generic vector<T,N> == binds IComparable scalar bool (witness cost beats OverloadRank) — #13969

In generic code with `T : __BuiltinFloatingPointType` or `T : __BuiltinIntegerType`, `vector<T,N> == vector<T,N>` and `!=` resolve to core's `bool operator==<T:IComparable>(T,T)` (core.meta.slang ~3650, `[OverloadRank(-10)]`). That gives a scalar `all(...)`, which is silently splatted to `bool3` when assigned. The component-wise generated `__generic<T:__BuiltinType,N> [OverloadRank(10)] vector<bool,N> operator==` loses because CompareOverloadCandidates compares conversionCostSum (witness upcast = +1/hop) BEFORE OverloadRank. `T:__BuiltinFloatingPointType -> __BuiltinType` costs 5 hops; `vector:IComparable` costs 2. With `T:__BuiltinArithmeticType`, the same comparison is component-wise. The builtin-op fast path (slang-check-expr.cpp `convertToBuiltinArithmeticOp`, ~L5062) explicitly declines generic vector equality. Its comment says glsl.meta.slang's vec==vec→bool overload is "visible regardless of scope", which is FALSE: the glsl module only loads via `import glsl`/GLSL source. Release-binary bisect: v2023.4.9 GOOD, v2023.4.10 (#3317, vector : IFloat) through current BROKEN. Quick bisect technique: `gh release download <tag> -R shader-slang/slang -p '*linux-x86_64*'` and inspect `-target hlsl` output. Workaround: build the `bool3` per component.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793188707381-generic-vector-t-n-binds-icomparable-scalar-bool-w.md`_
