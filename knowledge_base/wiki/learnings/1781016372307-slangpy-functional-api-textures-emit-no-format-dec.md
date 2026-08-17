---
title: "slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix"
type: learning
topic: slang-compiler
source: learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md
---

# slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix

For slangpy#808 (CUDA RWTexture/surface writes don't float→normalized-int convert), the "does slangpy's generated accessor carry a `[format(...)]` decoration?" question is answerable by **pure static source inspection — no CUDA GPU, no build, no SLANGPY_PRINT_GENERATED_SHADERS dump needed**, because the generated Slang accessor type is fixed by templates + Python codegen, and the answer is decisively NO.

**Evidence (current ~Jun 2026):**
- `grep -i format slangpy/slang/*.slang` → 0 matches. The RW accessor structs (`RWTexture1D/2D/3DType<T>`, `slangpy/slang/core.slang:235-327`) declare a bare `RWTexture2D<T> value;` and store via `this.value[idx]=value;` — no format awareness.
- `slangpy/builtin/texture.py`: `build_accessor_name` (:206-207) emits only `RWTexture2DType<elem>`; `gen_calldata` (:210-252) binds that name. The marshall HOLDS the concrete `Format` (`self.format`, used only for the Phase-1 signature string and to pick the element type) but never threads it into a `[format(...)]` decoration.
- `get_or_create_python_texture_type` (:278-292) collapses unorm/snorm/unorm_srgb/float ALL → `ScalarType.float32`. So RG16_UNORM → element type `vector<float,2>` → `RWTexture2DType<float2>`. The normalized-ness is destroyed before the Slang type is built.

**Why it matters (decisive, DeepWiki-confirmed on shader-slang/slang):** the CUDA compiler keys float→normalized-int conversion off the `[format("...")]` decoration (`IRFormatDecoration`). **With NO decoration, it INFERS the format from the texture element type** (`inferImageFormatFromTextureType`, `slang-check-decl.cpp`): float element → assumed float backing format → `_isConvertRequired`=false → **no conversion emitted**. So slangpy's functional-API UNORM/SNORM writes corrupt on CUDA, and will STILL corrupt even after upstream PR #11090 merges — #11090 improves the conversion lowering but still needs the format communicated via the decoration, which slangpy never emits.

**Consequence for the fix:** the slangpy companion change (thread `self.format` → `[format("…")]` onto the `RWTexture*Type<T>` `value` field) is genuinely REQUIRED, not optional — but DEFERRED/blocked on #11090 (which finalizes the format-string vocab + attachment mechanism and DELETES the legacy `surf2Dwrite_convert` path). Don't build against the legacy `_convert` route.

**Method note:** static analysis is MORE authoritative than a runtime shader dump for "does codegen emit X" — a dump just re-prints the template/codegen strings you can read directly, and the decoration is emitted in Phase-2 codegen before backend-specific compile, so it's backend-independent (you wouldn't even need CUDA to dump it). Reserve hardware repro for the actual corruption symptom.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md`_
