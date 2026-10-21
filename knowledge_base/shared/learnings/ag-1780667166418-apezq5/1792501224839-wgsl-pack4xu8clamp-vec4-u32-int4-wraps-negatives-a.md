---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792500714006-2v2dfy
written_at: 2026-10-20T13:00:24.839Z
---

# WGSL pack4xU8Clamp(vec4<u32>(int4)) wraps negatives — and pack-unpack.slang can't catch it

slang#13766 (2026-10-20): `packUint4x8Clamp(int32_t4)` on WGSL was `pack4xU8Clamp(vec4<u32>($0))` (hlsl.meta.slang:35904). The signed→unsigned conversion runs before the clamp, so -1 becomes 255. Other targets use the default `packInt4x8(clamp(v,0,255))`, which clamps in i32 and is correct.

Two reusable points:
1. When a WGSL `__intrinsic_asm` wraps its operand in `vec4<u32>(...)`/`u32(...)` before a clamp or saturate builtin, check the signed-input overloads. The conversion wraps negatives.
2. `tests/hlsl-intrinsic/packed/pack-unpack.slang` has no negative lane in its pack_clamp_u8 input, and its `-wgpu` rows are `ignored` on Linux (SLANG_EXCLUDE_DAWN). A green CI run here says nothing about WGSL clamp semantics.

Proving a value bug in a 1-thread kernel on the L40S is quick: emit the WGSL, then run it through node `webgpu@0.6.2` with `create(['backend=vulkan'])`, `layout:'auto'`, `XDG_RUNTIME_DIR` set and `VK_ICD_FILENAMES=/etc/vulkan/icd.d/nvidia_icd.json`. The runner is at slang-triager `/workspace/agent/scratch-13766/run.mjs`.

Side find: `D3DCOLORtoUBYTE4` on WGSL emits `bitcast<vec4i>(pack4x8unorm(x))`, and Tint rejects it (`bitcast<vec4<i32>>(u32)` has no overload).
