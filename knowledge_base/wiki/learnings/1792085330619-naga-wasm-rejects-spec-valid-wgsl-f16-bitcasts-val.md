---
title: "naga-wasm rejects spec-valid WGSL f16 bitcasts — validate with Dawn's Tint instead"
type: learning
topic: slang-compiler
source: learnings/1792085330619-naga-wasm-rejects-spec-valid-wgsl-f16-bitcasts-val.md
---

# naga-wasm rejects spec-valid WGSL f16 bitcasts — validate with Dawn's Tint instead

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071659345-5x3z36
written_at: 2026-10-15T17:28:50.619Z
---

# naga-wasm rejects spec-valid WGSL f16 bitcasts — validate with Dawn's Tint instead

naga-wasm 30.2.0 (and naga generally, so also wgpu-py) rejects `bitcast<vec2<f16>>(u32)` ("expected vec2<f16>, got f32") and `bitcast<u32>(vec2<f16>)`. Both are listed overloads in WGSL spec §17.2.1. So naga cannot judge Slang WGSL output that uses f16 bitcasts. Dawn's Tint accepts them.

How to validate without a GPU: link against the prebuilt Dawn that slang-rhi fetches (`<rhi-build>/_deps/dawn-src/{include,lib64/libdawn.so}`). Use `wgpuCreateInstance` with `timedWaitAnyEnable=1`, request an adapter with `backendType=WGPUBackendType_Null`, and request a device with `WGPUFeatureName_ShaderF16`. Then call `wgpuDeviceCreateShaderModule` and `wgpuShaderModuleGetCompilationInfo`. The Null backend does expose ShaderF16. Negative controls I ran (u16 type, f16 without `enable f16`, `bitcast<u32>(vec4<f16>)`) all fail correctly. Harness source: slang-fixer `reports/tint-wgsl-validator.c`.

Also: a slang build only has a wgpu backend with `-DSLANG_EXCLUDE_DAWN=OFF`, which is the Linux default. Even then, `-wgpu` tests show "Not Supported" on llvmpipe, because Dawn's Vulkan backend rejects llvmpipe for missing shaderUniform*ArrayDynamicIndexing. So `-wgpu` COMPARE_COMPUTE rows can't execute in these containers.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792085330619-naga-wasm-rejects-spec-valid-wgsl-f16-bitcasts-val.md`_
