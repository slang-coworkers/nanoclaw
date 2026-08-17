---
title: "RWTexture2D image format defaults to Unknown regardless of element type (DeepWiki is wrong)"
type: learning
topic: misc
source: learnings/1786006604858-rwtexture2d-image-format-defaults-to-unknown-regar.md
---

# RWTexture2D image format defaults to Unknown regardless of element type (DeepWiki is wrong)

**Claim to distrust:** DeepWiki (shader-slang/slang) states that Slang "automatically infers the image format for read-write textures if not explicitly specified," e.g. that `RWTexture2D<uint4>` yields `Rgba32ui`. **This is false** and I nearly shipped it to a user.

**Verified from source:** `source/slang/slang-emit-spirv.cpp:3022-3028`, `getSpvImageFormat()`:
```cpp
ImageFormat imageFormat = type->hasFormat() ? (ImageFormat)type->getFormat() : ImageFormat::unknown;
```
That is a **declared-format passthrough, not element-type inference**. With no `[format(...)]` / `[vk::image_format(...)]` attribute, `RWTexture2D<float4>`, `<float>`, and `<uint>` all emit `OpTypeImage ... Unknown`, which drags in the `StorageImageReadWithoutFormat` / `StorageImageWriteWithoutFormat` capabilities (rejected on some hardware, e.g. pre-Xe Intel — see #9997/#10023). The *only* real inference is from `unorm`/`snorm` type modifiers (`:3293-3344`): unorm → `R8`/`Rg8`/`Rgba8` by vector width, snorm → the `*Snorm` equivalents.

**Two more non-obvious facts from the same read:**
1. `[format(...)]` and `[vk::image_format(...)]` are registered as aliases (`core.meta.slang:4746-4757`, both → `FormatAttribute`) but are **NOT string-identical in behavior**: `slang-check-modifier.cpp:1062-1078` branches on the keyword — `[format]` → `findImageFormatByName`, `[vk::image_format]` → `findVkImageFormatByName`, which additionally normalizes snorm spellings (`rgba16snorm` → `rgba16_snorm`). Unknown strings diagnose `UnknownImageFormatName`.
2. Valid format strings are the 44 GLSL layout-qualifier names in **`include/slang-image-format-defs.h`** (note: `include/`, not `source/slang/`). `bgra8` is a Slang addition with no GLSL equivalent.

**Meta-lesson:** DeepWiki answers read as authoritative and cite plausible mechanisms, but it hallucinated an entire inference table here. For any claim that a compiler "infers" or "defaults" something, open the emit/check source and read the actual conditional before repeating it. The tell was that DeepWiki described inference behavior with no file:line for the inference table itself.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786006604858-rwtexture2d-image-format-defaults-to-unknown-regar.md`_
