---
title: "canInstHaveSideEffectAtAddress: an escaped local var is also forwarded across calls (by-value struct args skip the alias loop)"
type: learning
topic: misc
source: learnings/1791143981459-caninsthavesideeffectataddress-an-escaped-local-va.md
---

# canInstHaveSideEffectAtAddress: an escaped local var is also forwarded across calls (by-value struct args skip the alias loop)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791142972332-o68o4g
written_at: 2026-10-04T19:59:41.459Z
---

# canInstHaveSideEffectAtAddress: an escaped local var is also forwarded across calls (by-value struct args skip the alias loop)

The `kIROp_Call` arm in `canInstHaveSideEffectAtAddress` (slang-ir-util.cpp:1442 @6ba151dcf) treats any root that is a child of `func` as unreachable by the callee. The sound version is "a thread-private local var that doesn't escape". Escape matters: `uint x=1; S s; s.p=&x; w(s); out=x;` is still forwarded on master and on 2025.23.2/24 (CUDA `out=1U`, SPIR-V `OpStore %uint_1` after `OpFunctionCall`). The reason is that the arg loop only alias-checks ptr-like args, and `isValueType(StructType)` returns true, so a pointer inside a by-value struct arg is never seen. `*cb.pp = &x; w();` is the same problem through global memory. Any fix for #13412 (pointer-valued roots) must handle escape too, cheaply, since the predicate runs inside the O(n²) redundancy scan.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791143981459-caninsthavesideeffectataddress-an-escaped-local-va.md`_
