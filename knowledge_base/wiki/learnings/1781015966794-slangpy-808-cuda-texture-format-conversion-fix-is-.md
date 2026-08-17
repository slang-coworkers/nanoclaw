---
title: "slangpy #808 CUDA texture format conversion: fix is upstream slang PR #11090, not slang-rhi"
type: learning
topic: slang-compiler
source: learnings/1781015966794-slangpy-808-cuda-texture-format-conversion-fix-is-.md
---

# slangpy #808 CUDA texture format conversion: fix is upstream slang PR #11090, not slang-rhi

## slangpy CUDA RWTexture format-conversion issues → search shader-slang/slang FIRST

Triaging slangpy #808 ("CUDA backend lacks format conversion for surface/texture writes"). The issue body and a prior learning both framed this as a **slang-rhi** fix (off-repo, bot-unpushable, patch-handoff). That framing is WRONG for this case.

**Reality (verified 2026-06-09):**
- CUDA `surf*Dwrite` does raw byte writes; float→normalized/packed-int conversion that D3D12/Vulkan do in hardware must be emitted into DEVICE code at the write site → only the **Slang compiler's CUDA codegen** can do it.
- slang-rhi already creates normalized CUDA arrays (e.g. `RG16Unorm → CU_AD_FORMAT_UNORM_INT16X2`). Its `format-conversion.h` pack/unpack are CPU-side only (used solely by `ClearEngine` for host-known clear values). slang-rhi cannot fix shader-initiated writes.
- slangpy emits a plain `RWTexture<T>[idx]=value` (`slangpy/slang/core.slang:253-260`) with NO `[format(...)]` decoration — not the bug, just downstream.

**The fix already exists in flight:** shader-slang/slang **#11088** (tracking) + draft **PR #11090** "CUDA surface format conversion prototype" (@skallweitNV). New IR pass `slang-ir-legalize-cuda-surface-format.cpp` replaces the legacy half-only `_convert` prelude (which had a byte-addressing bug and is being deleted). Supports UNORM/SNORM/int/half/bgra; diagnoses CUDA-incompatible packed formats (rgb10_a2, r11f_g11f_b10f) as E55210. 244/244 CUDA tests pass. Touches ZERO slang-rhi files.

**Triage takeaways:**
1. For any slangpy issue about a missing GPU-codegen capability (texture formats, intrinsics, target-specific behavior), `gh pr list -R shader-slang/slang --search "<topic>" --state all` and check for an existing tracking issue/PR BEFORE assuming a slang-rhi patch-handoff or writing a slangpy fix. A core maintainer may already own it.
2. slangpy companion change for #11090: the IR pass keys off the `[format(...)]` decoration, which slangpy's generated accessors lack — so post-#11090, slangpy may need to thread `marshall.self.format` → `[format("rgXX")]` onto the generated `RWTexture` type (`slangpy/builtin/texture.py:210-292`, `slangpy/slang/core.slang:253-327`). DEFERRED until #11090 lands. Verify with `SLANGPY_PRINT_GENERATED_SHADERS=1`.
3. The "slang-rhi cross-repo patch-handoff" pattern from prior learnings does NOT always apply — confirm where the fix actually lives before assuming the bot can't push.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781015966794-slangpy-808-cuda-texture-format-conversion-fix-is-.md`_
