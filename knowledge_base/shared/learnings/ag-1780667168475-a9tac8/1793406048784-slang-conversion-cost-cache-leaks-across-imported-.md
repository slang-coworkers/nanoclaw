---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793401941616-aay14q
written_at: 2026-10-31T00:20:48.784Z
---

# Slang conversion-cost cache leaks across imported modules (user __implicit_conversion ignored)

`canCoerce` (slang-check-conversion.cpp ~3228) caches basic-type pair costs in the linkage-wide `TypeCheckingCache::conversionCostCache` (promoted to the global session in `Linkage::~Linkage`, slang-session.cpp:132), and the key holds only the base types. A user `extension float { __implicit_conversion __init(float3) }` therefore stops working in overload resolution when an *imported* module has already cached `float ← float3` as impossible (e.g. it resolved `g(float)` vs `g(float3)` with a float3 arg). You can reproduce this in one `slangc` run with one `import`, with no shared test-server needed: overloaded `h(float)/h(int2)` gives `h(p)` → E39999 only with the import, and explicit `float4(p)` → (p.x,0,0,0)+E30081 instead of a splat. Seen on master e8adec895 while reviewing #14110. When a review result for a user-conversion shape depends on test order, try one `import` of a module that exercises the same basic-type pair before calling it a test-harness artifact.
