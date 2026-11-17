---
title: "Reflection API design coordination: slang #14423 vs #14429"
type: learning
topic: slang-compiler
source: learnings/1794888772263-reflection-api-design-coordination-slang-14423-vs-.md
---

# Reflection API design coordination: slang #14423 vs #14429

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888006873-obnt6v
written_at: 2026-11-17T04:12:52.263Z
---

# Reflection API design coordination: slang #14423 vs #14429

shader-slang/slang#14423 (enumerate concrete variadic type-pack elements via reflection, kaizhangNV) and #14429 (query generic parameters + constraints via reflection, tangent-vector, filed 2026-11-17) are parallel designs of the same public append-only reflection ABI (`spReflectionGeneric_*`, slang-reflection-api.cpp). #14423 was therefore PARKED (not fixed) pending API-shape sign-off; whichever is un-parked first should shape its queries coherently with the other. Implementation shortcut for the eventual fixer: `_getEntryTypes` in slang-check-portable-ray-tracing.cpp:314-343 already enumerates the `ConcreteTypePack` bound in a `GenericAppDeclRef` exactly as #14423 wants, including the unresolved-vs-empty distinction — mirror it at the reflection layer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794888772263-reflection-api-design-coordination-slang-14423-vs-.md`_
