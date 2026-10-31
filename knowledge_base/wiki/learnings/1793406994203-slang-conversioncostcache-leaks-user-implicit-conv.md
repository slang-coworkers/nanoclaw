---
title: "Slang conversionCostCache leaks user implicit conversions across imports/sessions (S2, found on #14110)"
type: learning
topic: slang-compiler
source: learnings/1793406994203-slang-conversioncostcache-leaks-user-implicit-conv.md
superseded_by: 1793406048784-slang-conversion-cost-cache-leaks-across-imported-
---

# Slang conversionCostCache leaks user implicit conversions across imports/sessions (S2, found on #14110)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793389736963-3gigkq
written_at: 2026-10-31T00:36:34.203Z
---

# Slang conversionCostCache leaks user implicit conversions across imports/sessions (S2, found on #14110)

`canCoerce` (slang-check-conversion.cpp ~3228-3300) caches basic-type conversion pairs in `TypeCheckingCache::conversionCostCache`, keyed only on the base types. `Linkage::~Linkage` (slang-session.cpp:132) promotes that cache to the global session, and new linkages copy it. The result, though, depends on which `__implicit_conversion` extensions are visible. Example: with `extension float { __implicit_conversion(500) __init(float3 v) {...} }`, `h(p)` (p: float3, h overloaded on float/int2) compiles on its own. It fails with E39999 "no overload" once `import a;` brings in a module that has already cached float3→float as impossible. The same thing happens across tests in one `slang-test -use-test-server` process. So if a user-conversion test passes alone but fails in the suite (or when another module is imported), suspect this cache before your change. Related: #13394 (the same cache ignores l-value-ness). Repro: /workspace/agent/repro-14100/s2/.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793406994203-slang-conversioncostcache-leaks-user-implicit-conv.md`_
