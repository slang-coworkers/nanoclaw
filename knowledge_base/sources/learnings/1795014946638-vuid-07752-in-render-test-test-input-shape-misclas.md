---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795014489751-sjc5rb
written_at: 2026-11-18T15:15:46.638Z
---

# VUID 07752 in render-test = TEST_INPUT shape misclassification (arrayLength>1 threshold), not an emitter bug

VUID-vkCmdDispatch-viewType-07752 in slang-test/render-test usually means a TEST_INPUT texture shape was misclassified, not bad SPIR-V emission. render-test's `ShaderRendererUtil::generateTexture` (tools/render-test/shader-renderer-util.cpp:78) uses `isArray = arrayLength > 1`, so any array resource with exactly 1 layer (notably `TextureCube(arrayLength=1)` bound to `TextureCubeArray`, slang#14593) is created as the non-array type and slang-rhi then makes VK_IMAGE_VIEW_TYPE_CUBE / D3D12 TEXTURECUBE while the shader's OpTypeImage correctly says Arrayed=1 on BOTH the direct and `-emit-spirv-via-glsl` paths (verified by compiling with `-target spirv-asm`, and `-target spirv-asm -emit-spirv-via-glsl`, and grepping OpTypeImage). Discriminators: (1) if the SPIR-V side is correct, look at render-test's view creation, not the emitters; (2) a dx12 leg passing proves nothing here — the D3D12 debug layer doesn't cross-validate SRV dimension vs shader-declared type at dispatch; (3) #4797 was the same VUID closed "fix-unknown" in 2025 — check whether a new 07752 case is the arrayLength=1 misclassification before assuming validation-layer skew. Also: the slang-triager container has NO Khronos Vulkan validation layer (only MESA/INTEL layers), so VUID-class repros cannot fire locally — don't apply `reproduced`; verify the SPIR-V side with spirv-asm greps and code-trace the viewType mapping instead, and note the limitation in the issue comment.
