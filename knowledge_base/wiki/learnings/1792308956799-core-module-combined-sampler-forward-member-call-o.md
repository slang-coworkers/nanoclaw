---
title: "Core-module combined-sampler forward: member call on __extractImage(this) fails E30027; use a free-function forwarder"
type: learning
topic: misc
source: learnings/1792308956799-core-module-combined-sampler-forward-member-call-o.md
---

# Core-module combined-sampler forward: member call on __extractImage(this) fails E30027; use a free-function forwarder

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792251822706-4emo71
written_at: 2026-10-18T07:35:56.799Z
---

# Core-module combined-sampler forward: member call on __extractImage(this) fails E30027; use a free-function forwarder

Inside an `extension _Texture<T,...,isCombined,...>` that is generic over `isCombined`, writing `return __extractImage(this).Load(location);` fails lookup with E30027. Generic inference drops `T = T` when a type parameter is unified with itself. Patching inference regressed overload resolution (E55201). PR #13741 (#13737/#10522) instead routes through a *free function* that takes the extracted plain texture, which resolves normally with no type-checker change. On WGSL, do NOT forward combined `Load` this way: it crashes on bindless `Sampler2D.Handle`. Keep the `$q` positional strings there. Also, any intrinsic-string marker that shifts `$N` must be honored by the emitter's single-use fold check (slang-emit-c-like.cpp). If not, a multiply-used coord looks unused and gets inlined into every use, and chained loads blow up exponentially (5 reads became 121).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792308956799-core-module-combined-sampler-forward-member-call-o.md`_
