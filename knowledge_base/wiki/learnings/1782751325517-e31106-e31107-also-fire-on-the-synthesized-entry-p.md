---
title: "E31106/E31107 also fire on the SYNTHESIZED entry-point uniform param group (not just imported modules)"
type: learning
topic: misc
source: learnings/1782751325517-e31106-e31107-also-fire-on-the-synthesized-entry-p.md
---

# E31106/E31107 also fire on the SYNTHESIZED entry-point uniform param group (not just imported modules)

**Context:** shader-slang/slang#11825 (skallweitNV, maintainer). Extends the two prior learnings on the locationless E31106/E31107 class (1780328920397, 1780418999087, which covered imported-module structs).

**New finding:** A plain single-file compute entry point that mixes resource params with a `uniform` ordinary param — e.g. `void testMain(uint3 tid : SV_DispatchThreadID, Texture2D<float4> tex, RWTexture2D<float4> rw, uniform int2 dim)` — emits E31106 ×1 + E31107 ×2 with **no source location**, on both `-target hlsl` and `-target spirv`. This is a *different code path* from the imported-module case #11395/PR #11424 already "fixed": here the offending `ConstantBuffer<>` is **compiler-synthesized**.

**Mechanism:** `CollectEntryPointUniformParams::ensureCollectedParamAndTypeHaveBeenCreated()` (source/slang/slang-ir-entry-point-uniforms.cpp:526-576) collects entry-point uniform/resource params into a fresh nominal struct (`createStructType`, :536) and wraps it in `ConstantBuffer<>` (`getConstantBufferType`, :557) **iff** the params include ordinary data (the `int2 dim`). Type legalization (slang-legalize-types.cpp:1237-1267) then sees the textures "leak" from that synthesized CB and warns. `findFirstUseLoc` (slang-ir-util.cpp:423-433) returns empty because the synthesized type has no loc and all its uses are synthesized insts.

**Contrast that pins the bug:** an *explicit* user `ConstantBuffer<S>` whose `S` mixes a USED resource + ordinary data DOES warn *with* a location (the decl + leaking member). So the missing-location is specific to compiler-synthesized groups.

**Two structural constraints for any fixer:**
1. `getConstantBufferType` is a **deduplicated type-getter** — you CANNOT stamp a per-instance `sourceLoc` on the CB type (it's interned/shared). The location/marker must live on the fresh non-deduped `paramStructType` (the CB's element), detectable at the legalize site via `as<IRConstantBufferType>(type)->getElementType()`.
2. `TypeLegalizationContext` at the emit site has no entry-point `IRFunc` handle, so a "real location" must be threaded via a struct decoration. `IREntryPointParamDecoration` (+ `addEntryPointParamDecoration`, slang-ir.h ~5320) already carries the entry-point func but is applied to the per-param global (entry-point-uniforms.cpp:652), NOT the synthesized struct.

**Design conclusion:** The warning was added (PR #10158, `Fixes #8818`) for *user-authored* mixed `cbuffer`/`[vk::push_constants]` groups. Firing it on the compiler-synthesized entry-point (and global-uniform `collectGlobalUniformParameters`) group is over-eager — the user wrote a flat parameter list, not the grouping, so there's nothing to restructure. Recommended fix = restrict E31106/E31107 to source-authored groups (mark the synthesized struct, skip the diagnose), which also moots the missing-location complaint. It's a maintainer-owned diagnostic-behavior call, so land it as a draft and confirm with the warning author.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782751325517-e31106-e31107-also-fire-on-the-synthesized-entry-p.md`_
