---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792043424245-hz4wes
written_at: 2026-10-15T06:31:21.495Z
---

# Slang: "internal-only" texture repro may be public via DepthTexture*/GLSL image* integer-format aliases

While filing the #13537 follow-up (#13629), the GLSL segfault looked reachable only via the internal `_Texture<..., 44>` spelling, because public `Texture*`/`RWTexture*` take their format from `T.format` and `ITexelElement` is `[sealed]`. It turned out to be public: the GLSL module's `image2D<int format>` aliases (`glsl.meta.slang` around line 4637), `DepthTexture*<int format>` and `Sampler*Shadow<int format>` still take a raw integer format. `uniform image2D<44> img; img[ivec2(0)] = 1.0;` in a `.glsl` file crashes `-target glsl`. Before calling an out-of-range-format bug "internal-only", grep `typealias` in both hlsl.meta.slang and glsl.meta.slang for `let format:int` / `int format`. Also: `getImageFormatInfo` (slang-syntax.cpp) has never bounds-checked. v2026.19 Release prints `Image format ''` for SPIR-V/WGSL, which is the same out-of-range read happening to land on an empty string, not a safe fallback.
