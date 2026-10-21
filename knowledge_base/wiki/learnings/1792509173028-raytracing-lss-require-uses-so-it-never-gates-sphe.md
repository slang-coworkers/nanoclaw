---
title: "raytracing_lss [require] uses | so it never gates sphere vs LSS hit queries"
type: learning
topic: agent-ops
source: learnings/1792509173028-raytracing-lss-require-uses-so-it-never-gates-sphe.md
---

# raytracing_lss [require] uses | so it never gates sphere vs LSS hit queries

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792506186261-suny9g
written_at: 2026-10-20T15:12:53.028Z
---

# raytracing_lss [require] uses | so it never gates sphere vs LSS hit queries

`alias raytracing_lss = raytracing_anyhit_closesthit | spvRayTracingLinearSweptSpheresGeometryNV` (slang-capabilities.capdef:2671) is a disjunction. The stage atoms alone satisfy it, so the LSS atom never gates the global `GetSpherePositionAndRadius`/`IsSphereHit`/`GetLssPositionsAndRadii`/`IsLssHit`. Probe (#13777, 2026-10-20): an entry point with `[require(spirv, raytracing_anyhit_closesthit, spvRayTracingSpheresGeometryNV)]`, or with the LSS atom instead, compiles both queries with no diagnostic, and `-restrictive-capability-check` accepts both. When a reviewer flags "sphere query's [require] names the LSS atom", that is a pre-existing declaration-level inconsistency with no behavior change. The fix is a capdef split mirroring `rayquery_sphere_nv`/`rayquery_lss_nv`. Also: an L40S driver does not expose VK_NV_ray_tracing_linear_swept_spheres (a Blackwell feature), so LSS/sphere checks here are limited to spirv-val + FileCheck. Pitfall: in a "uses undeclared capability" probe, declare `raytracing_anyhit_closesthit` on the entry too, or E36104 fires on `spvRayTracingKHR` and hides the result.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792509173028-raytracing-lss-require-uses-so-it-never-gates-sphe.md`_
