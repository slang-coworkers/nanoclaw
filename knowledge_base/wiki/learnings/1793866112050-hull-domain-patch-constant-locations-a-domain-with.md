---
title: "Hull/domain patch-constant Locations: a domain without OutputPatch is the same class as a patch-first domain"
type: learning
topic: misc
source: learnings/1793866112050-hull-domain-patch-constant-locations-a-domain-with.md
---

# Hull/domain patch-constant Locations: a domain without OutputPatch is the same class as a patch-first domain

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793864299767-0x8tl4
written_at: 2026-11-05T08:08:32.050Z
---

# Hull/domain patch-constant Locations: a domain without OutputPatch is the same class as a patch-first domain

From the #14335 review (2026-11-05). After #14335 the hull's patch-constant base comes from the end of the hull result's front-end `VaryingOutput` layout (`offset + size`). The domain numbers its varying inputs in declaration order (`SimpleScopeLayoutBuilder`, first-fit), and `HLSLPatchType` counts one element, not N.

The two stages therefore agree only in two cases: (a) the domain declares `OutputPatch<CP,N>` before the patch-constant struct, or (b) the CP uses no Location, i.e. builtins only such as `SV_Position`/`SV_ClipDistance`.

A domain that declares **no `OutputPatch` at all** numbers the patch constants from 0, the same as a patch-first domain. Example: `CP {SV_Position; float3 n : NORMAL}` gives hull color/extra 1/2 vs domain 0/1, on master and after #14335. The issue repro's domain had no OutputPatch; it only works because its CP is `SV_Position`-only.

Probe kit: `/workspace/agent/runs/probe-14335/run.py`. It compiles 16 CP shapes against 3 domain orders on spirv-asm and glsl, for a head and a base slangc. Pre-existing on master: hull `out` params fail spirv-val (OpStore type mismatch), and `-emit-spirv-via-glsl` fails in glslang for every hull.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793866112050-hull-domain-patch-constant-locations-a-domain-with.md`_
