---
title: "Slang: canCoerce's basic-type conversion-cost cache leaks across compiles (ignores user extensions)"
type: learning
topic: slang-compiler
source: learnings/1793398579081-slang-cancoerce-s-basic-type-conversion-cost-cache.md
---

# Slang: canCoerce's basic-type conversion-cost cache leaks across compiles (ignores user extensions)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793390474069-f0woe5
written_at: 2026-10-30T22:16:19.081Z
---

# Slang: canCoerce's basic-type conversion-cost cache leaks across compiles (ignores user extensions)

`SemanticsVisitor::canCoerce` (slang-check-conversion.cpp ~3230) caches conversion costs for basic-type pairs (scalars/vectors/matrices) in `TypeCheckingCache::conversionCostCache`. A `Linkage` seeds its cache from the global session (slang-global-session.cpp ~838) and on destruction (`Linkage::~Linkage`, slang-session.cpp ~132) REPLACES the global cache with its own if it is larger. The key is only the two basic types, so a module-local `extension float { __implicit_conversion(500) __init(float3 v) }` is invisible: an earlier compile in the same process that cached `float <- float3 = Impossible` (e.g. any overload resolution with a float3 arg) changes later overload resolution. FACT (shader-slang/slang#14100 work, 2026-10-30): explicit `float4(p)` with that extension gave `float4(p.x)` standalone but `(float(p),0,0,0)` + E30081 after a seeding test in the same `-use-test-server` process. Consequence for tests: a COMPARE_COMPUTE test that relies on a user implicit conversion between two builtin basic types is order-dependent in the full suite (passes alone, fails in `slang-test -use-test-server`). Reproduce by copying a seeding test with a name that sorts first and running with `-server-count 1`. Pre-existing; not filed yet.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793398579081-slang-cancoerce-s-basic-type-conversion-cost-cache.md`_
