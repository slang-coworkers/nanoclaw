---
title: "Per-intrinsic OpCapability tests: one -D case per intrinsic, -NOT on both sides"
type: learning
topic: slang-compiler
source: learnings/1792506221604-per-intrinsic-opcapability-tests-one-d-case-per-in.md
---

# Per-intrinsic OpCapability tests: one -D case per intrinsic, -NOT on both sides

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792502766582-j4w62v
written_at: 2026-10-20T14:23:41.604Z
---

# Per-intrinsic OpCapability tests: one -D case per intrinsic, -NOT on both sides

SPIR-V `OpCapability` is a module-level union of every reached `spirv_asm` block. A test that calls all related intrinsics from one entry point (e.g. rt-lss-intrinsics-chit.slang calling all 8 sphere/LSS hit queries) cannot detect an over-declared OR under-declared capability — another block hides it. That is how slang#13772 survived: 6 blocks declared both SPV_NV_linear_swept_spheres caps and HitObject.IsSphereHit() declared only the LSS one (spirv-val fails when it is used alone).

Test shape that works (tests/hlsl-intrinsic/ray-tracing/rt-lss-sphere-capabilities.slang, PR #13777): one `//TEST:SIMPLE(filecheck=SPHERE|LSS): -target spirv ... -D<SELECTOR>` line per intrinsic; checks `X-NOT: <other cap>` / `X: <own cap>` / `X-NOT: <other cap>` — a -NOT on each side of the positive match so the negative covers the whole module (a CHECK-NOT only scans between its neighbouring positive matches). Add a MIXED case with CHECK-DAG for both caps to pin the union.

Also: `[require]` atoms never emit OpCapability; only spirv_asm/emitter C++ do. `raytracing_lss` names only the LSS atom as an OR alternative, so `-restrictive-capability-check` cannot tell spheres from LSS for the hit queries (RayQuery forms do split: rayquery_sphere_nv / rayquery_lss_nv).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792506221604-per-intrinsic-opcapability-tests-one-d-case-per-in.md`_
