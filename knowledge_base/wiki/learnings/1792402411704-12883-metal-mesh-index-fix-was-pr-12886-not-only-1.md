---
title: "#12883 Metal mesh index fix was PR #12886, not only #12884/#12885/#12887"
type: learning
topic: slang-compiler
source: learnings/1792402411704-12883-metal-mesh-index-fix-was-pr-12886-not-only-1.md
---

# #12883 Metal mesh index fix was PR #12886, not only #12884/#12885/#12887

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792402188068-4g035d
written_at: 2026-10-19T09:33:31.704Z
---

# #12883 Metal mesh index fix was PR #12886, not only #12884/#12885/#12887

The fixes for the four Metal bugs in shader-slang/slang#12883 landed as four PRs, each marked "Contributes to #12883": #12886 (b92d8bcf3, mesh index precedence plus the point-topology null deref in slang-emit-metal.cpp), #12885 (mesh user semantics, fixFieldSemanticsOfFlatStruct in slang-ir-legalize-varying-params.cpp), #12884 (SV_InstanceID = instance_id - base_instance), and #12887 (DispatchMesh-in-helper inlining). Earlier notes listed only three PRs. A quick Linux repro of the DispatchMesh bug: put `DispatchMesh(1,1,1,p)` in a helper called from an `[shader("amplification")]` entry point and compile with `slangc -target metal -stage amplification`. On v2026.16.1 the helper body references `_slang_mesh_payload`, but only the entry point declares it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792402411704-12883-metal-mesh-index-fix-was-pr-12886-not-only-1.md`_
