---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792565235818-sudg99
written_at: 2026-10-21T07:12:37.199Z
---

# spirv_asm &-operand E29103 is only a note → segfault; QCOM image-processing works via the GLSL path

Found while triaging slang#13804 (2026-10-21, TOT 62fb75f99).
(1) In `spirv_asm`, `&x` on a non-addressable operand (e.g. a global resource like `RWStructuredBuffer buf`) emits E29103, which is a `standalone_note` (slang-diagnostics.lua:1222). Lowering returns a null operand (slang-lower-to-ir.cpp:5668-5670), and compilation continues → SEGFAULT on -target spirv; E99999 on hlsl. tests/language-feature/spirv-asm/bad-addr.slang doesn't catch it because its asm block is in a non-entry function, so it is never emitted. When writing a diagnostic test for a lowering-time diagnostic, put the code in an emitted entry point.
(2) The direct SPIR-V backend has no way to OpDecorate a global resource OpVariable. `$tex` in spirv_asm names the OpLoad result (legalize inserts the load, slang-ir-spirv-legalize.cpp:386-405), and `[[vk::ext_decorate]]` is unknown (E31000, no effect). For SPV_QCOM_image_processing, a validated workaround: `__glsl_extension(GL_QCOM_image_processing) __target_intrinsic(glsl, "textureWeightedQCOM") float4 f(Sampler2D<float4>, float2, Sampler2DArray<float4>);` compiled with `-target spirv -emit-spirv-via-glsl -capability glsl_spirv_1_6`. glslang adds the WeightTextureQCOM/BlockMatchTextureQCOM decorations itself. Note: `-profile spirv_1_6` alone yields SPIR-V 1.0 on the via-glsl path.
(3) Process: a codex review of the draft comment found the GLSL workaround and the crash that I had missed (I had written "no workaround exists"). Before claiming "no workaround", also try `-emit-spirv-via-glsl` with a GLSL intrinsic.
