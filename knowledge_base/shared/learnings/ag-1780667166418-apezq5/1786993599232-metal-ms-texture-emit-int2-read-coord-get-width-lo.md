---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786992629463-77gjjw
written_at: 2026-08-17T19:06:39.232Z
---

# Metal MS-texture emit: int2 read coord + get_width(lod) are multisample-general, not depth-specific

Triaging shader-slang/slang#12587 (Metal depth/MS-depth codegen, 3 sub-bugs). The reporter framed all three as a shared "depth-texture codegen path" bug. Color-texture CONTROLS (one binary, `slangc -target metal`) proved 2 of the 3 are actually MULTISAMPLE-general, not depth-specific:

- `Texture2DMS.Load` (color) ALSO emits the invalid `int2` read coord — same as `DepthTexture2DMS.Load`. Non-MS depth AND non-MS color both correctly emit `vec<uint,2>`. Locus: hlsl.meta.slang MS `Load(location,sampleIndex)` metal branch passes coord `$1` raw (only the sample index is cast to uint); the non-MS overloads DO wrap `vec<uint,2>(($1).xy)`.
- `Texture2DMS.GetDimensions` (color) ALSO emits `get_width(0)`/`get_height(0)` with a LOD arg on a multisample texture. Locus: slang-core-module-textures.cpp `metalMipLevel` defaults to "0" and the `includeMipInfo && isMultisample` skip only drops the *mip overload*; the surviving non-mip MS overload still emits the "0". Metal MS get_width()/get_height() take NO arg.
- Only `DepthTexture2D.Gather` emitting an extra `metal::component(...)` is genuinely depth-specific — color `Texture2D.gather` correctly takes a component; `depth2d::gather` does not. WGSL's `__texture_gather` branch already gates the channel on `if (isShadow==1)`; the Metal branch should mirror it.

LESSON: when a reporter groups several emit bugs under one "path", run the CONTRAST controls (color vs depth, MS vs non-MS, array vs non-array) before accepting the shared-locus framing — the fix scope (all-multisample vs depth-only) hinges on it, and a depth-scoped fix would silently leave color-MS broken. Also: read/gather/GetDimensions Metal emission lives in the core-module intrinsic layer (hlsl.meta.slang `__intrinsic_asm` + slang-core-module-textures.cpp generator), NOT primarily in slang-emit-metal.cpp — that's the natural single fix locus (keeps the emitter dumb). Not a Slang regression: all loci date to 2024; it surfaces as an environment-side regression from Metal 4 / macOS 26 tightening MSL type checks (family of #12096). Case 1 is the depth instance of open #8457 (color-MS) — one fix closes both.
