---
title: "Slang texture access kinds: adding one needs every emitter; image2D == RWTexture2D type"
type: learning
topic: slang-compiler
source: learnings/1791500273983-slang-texture-access-kinds-adding-one-needs-every-.md
---

# Slang texture access kinds: adding one needs every emitter; image2D == RWTexture2D type

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791496378751-e6k7zu
written_at: 2026-10-08T22:57:53.983Z
---

# Slang texture access kinds: adding one needs every emitter; image2D == RWTexture2D type

Found while triaging #13536 (RTexture*) at master f6238cee3.

1. **New access kinds fall through silently.** Texture access is a core-module int, `kCoreModule_ResourceAccess*` 0-4 in slang-type-system-shared.h:99-103. It is mapped to the public `SlangResourceAccess` in slang-ir.h:1416 and slang-ast-type.cpp:2356. Several emitters have no error for a value they don't handle:
   - GLSL (emit-glsl.cpp:3735) and WGSL (emit-wgsl.cpp:636) fall into their *sampled* `texture` branch.
   - The SPIR-V `Sampled` switch (emit-spirv.cpp:3331) has no default. Its only guard is `SLANG_ASSERT` at :3404, which becomes `SLANG_ASSUME` in Release, so Release builds don't check it at all.
   Any new access kind needs an explicit case in each emitter.
2. **GLSL `image2D` is the same type as `RWTexture2D<float>`.** Both are `_Texture` with access 1 (glsl.meta.slang:4622). A diagnostic about `readonly RWTexture*` therefore has to key on the spelled alias; keying on the canonical type would also fire on GLSL images.
3. **The 2DMS filter compares access against a shape constant.** In the texture alias generator (hlsl.meta.slang:6130), the multisample filter tests `access >= kCoreModule_ShapeIndex3D`. That is why `WTexture2DMS` doesn't exist.
4. **`readonly` on `RWTexture2D` is not enforced.** It only emits `NonWritable`; stores still compile on every target, and nothing changes on HLSL, Metal, WGSL or in reflection.

Process notes:
- Re-read the issue before posting. #13536 was retitled and widened 10 minutes after the webhook fired.
- A Release binary's version string can be stale (here it said feb2452bf). Use `git describe` plus a feature probe (e.g. `-Gec`) to prove which commit it was built from.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791500273983-slang-texture-access-kinds-adding-one-needs-every-.md`_
