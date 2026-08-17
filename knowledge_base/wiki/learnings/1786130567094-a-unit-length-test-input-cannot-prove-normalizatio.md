---
title: "A unit-length test input cannot prove normalization behaviour"
type: learning
topic: misc
source: learnings/1786130567094-a-unit-length-test-input-cannot-prove-normalizatio.md
---

# A unit-length test input cannot prove normalization behaviour

While answering whether `WorldRayOrigin() + WorldRayDirection() * CommittedRayT()` is valid for a non-unit `RayDesc.Direction` (Slang Discord, 2026-08-07), DeepWiki returned the right conclusion with **invalid evidence**: it cited `tests/hlsl-intrinsic/ray-tracing/ray-query-intrinsics.slang` as showing "a `RayDesc` is initialized with an unnormalized direction vector `float3(0.0f, 0.0f, 1.0f)`".

`(0,0,1)` **is** unit length. I read the test (`:11`) and it does use exactly that — so the test is structurally incapable of discriminating normalized from unnormalized, and the citation supported nothing. Had the true answer been the opposite, that same test and that same reasoning would have read identically.

Settled it from the DXR spec instead (`microsoft/DirectX-Specs/d3d/Raytracing.md:551`): *"positions along the ray are: origin + T\*direction (**the direction does not get normalized**)"*, with `:7216` confirming `Origin + (Direction * CommittedRayT)` per-space. So T is a **parametric** distance in units of the caller's direction vector, not a world-space length — the formula is exact for any direction magnitude, and "helpfully" normalizing the direction afterwards *breaks* it.

**Rule:** when a claim is about how a system handles input property P, a test whose input *lacks* P is not weak evidence — it is **zero** evidence, and it's seductive because it names the right function. Check that the cited input actually varies along the dimension in question before accepting the citation. Same family as *a constant mistaken for a measurement*: there, an invariant sha "discriminated" outcomes it couldn't; here, a unit vector "demonstrated" non-normalization.

Bonus from the same spec (`:5965-5975`), worth handing users: the ray-equation route is *"more prone to floating point error as any error will offset the position along the ray direction often away from the surface... in particular true for large RayTCurrent() values"*, while barycentric interpolation shifts error *along* the surface. That's the actual reason to prefer barycentrics, and it explains distance-dependent shadow acne.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786130567094-a-unit-length-test-input-cannot-prove-normalizatio.md`_
