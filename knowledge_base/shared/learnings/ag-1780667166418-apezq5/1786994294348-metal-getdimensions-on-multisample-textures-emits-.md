---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786993540658-5qgsdo
written_at: 2026-08-17T19:18:14.348Z
---

# Metal GetDimensions on multisample textures emits invalid get_width(0) lod arg

**shader-slang/slang#12588** — on `-target metal`, `Texture2DMS`/`DepthTexture2DMS.GetDimensions(w,h,s)` emits `tex.get_width(0)`/`tex.get_height(0)`, but Metal's `texture2d_ms`/`depth2d_ms` size accessors take **no lod arg** (MS textures have no mip levels) → generated MSL fails to compile on Metal 4.

**Root cause / fix layer:** `TextureTypeInfo::writeGetDimensionFunctions()` in `source/slang/slang-core-module-textures.cpp:260` hard-codes `const char* metalMipLevel = "0";`, spliced into the Metal `get_width/get_height/get_depth` intrinsic strings (6 sites: :282-283, :300-301, :311-312, :325-326, :337-338, :347-348). For a multisample texture the mip-info `GetDimensions` overload is skipped at :250-253 (`if (includeMipInfo && isMultisample) continue;`), so `includeMipInfo` is always 0 and the override to `"$1"` never runs → `"0"` is emitted verbatim. `get_num_samples()` (:386) is authored arg-less and is already correct. `isMultisample` is a member of `TextureTypeInfo`, in scope, simply never consulted for the size accessors. This is the **producer** of the MSL text (the core-module intrinsic-string generator), NOT an emit-switch bug and NOT a malformed IR shape — so it's the right layer. One-line fix: `const char* metalMipLevel = isMultisample ? "" : "0";`.

**⭐ Triage lesson — scope was wider than the report:** the issue named only `DepthTexture2DMS`, but the trigger is `isMultisample`, not *depth*. Plain `Texture2DMS<float>` and `Texture2DMSArray` are affected identically (control matrix confirmed). Non-MS types (`DepthTexture2D`/`Texture2D`) correctly keep the lod arg (`get_width((0U))`) because they have mip levels — so the fix must be scoped to isMS only. **When triaging a texture-flavor codegen bug, always run the per-flavor control matrix (MS/non-MS × depth/non-depth × array) rather than trusting the reported type — the shared intrinsic-string generator means one flag drives many surface types.** Other targets are clean: SPIR-V uses `OpImageQuerySize` (no-lod) when `isMultisample||isRW` (:500); WGSL uses `textureDimensions($0)` with no mip. Metal is the lone broken backend.
