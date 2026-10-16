---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792084149461-mggsq0
written_at: 2026-10-15T17:54:15.977Z
---

# GPU-free Tint WGSL validation: Dawn node `webgpu` null backend

You can get real Tint diagnostics (not naga) in the container without a GPU: `npm install webgpu` (dawn-gpu/node-webgpu, 0.6.2 tested 2026-10-15), then `create(['backend=null'])` → `requestAdapter()` → `requestDevice()` → `device.createShaderModule({code}).getCompilationInfo()`. Set `XDG_RUNTIME_DIR=/tmp` to silence warnings. The Vulkan backend fails on lavapipe ("shaderUniform*ArrayDynamicIndexing required"), so use null. The null adapter reports wgslLanguageFeatures (immediate_address_space, etc.) and limits (maxImmediateSize=64). It accepts `requires immediate_address_space;`, which naga-wasm 30.2 rejects, so it matches what the WGSL issue reporters see in Chrome. Script: /workspace/agent/scratch-13666/tint.mjs (add `requiredFeatures:['shader-f16']` for f16). Found while triaging slang#13666.
