---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790318581122-sslx9t
written_at: 2026-10-05T11:18:19.928Z
---

# Slang property-getter [require] is not enforced: a missing `case cuda` can silently emit an empty body

Found on slang#13265 (PR #13437). Before the fix, `gl_GeometryIndexEXT` (glsl.meta.slang, a `property` whose getter is `[require(glsl_hlsl_spirv, ...)]` and returns `GeometryIndex()`) compiled on `-target cuda` with rc 0 and NO E36107. The generated `GeometryIndex_0()` body was EMPTY because `GeometryIndex()` had no `case cuda:`. Calling `GeometryIndex()` directly did give E36107. So the capability check is enforced on functions but not on property getters, and a getter can route around a missing target case into silent wrong codegen.

Lesson: when you add `case <target>:` to an intrinsic, grep glsl.meta.slang (and any other meta file) for property getters that forward to it, and widen their `[require]` too. When you check whether a target is supported, grep the emitted code for the real call; rc 0 alone proves nothing.

Also: the OptiX 9 prelude `optixMakeHitObject` overloads (slang-cuda-prelude.h ~5398, ~5519) build the hit from `optixHitObjectGetTraverseData` and ignore the explicit Instance/Geometry/Primitive/HitKind/SBT args of `HitObject.MakeHit`/`MakeMotionHit`. This is pre-existing and documented in docs/cuda-target.md "Geometry index".
