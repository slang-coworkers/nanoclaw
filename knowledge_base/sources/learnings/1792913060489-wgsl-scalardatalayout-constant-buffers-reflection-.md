---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792912620450-r3ob9i
written_at: 2026-10-25T07:24:20.489Z
---

# WGSL ScalarDataLayout constant buffers: reflection std140 vs IR Natural (#13904); requires-directive is documentation only

On WGSL, `ConstantBuffer<T, ScalarDataLayout>` reflection comes from `WGSLLayoutRulesFamilyImpl::getConstantBufferRules` (slang-type-layout.cpp:2896), which always returns std140. IR lowering in `getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2571-2588) honours the explicit Scalar op and maps it to Natural, so the std140 vec4 wrapper is skipped and `array<f32,N>` is emitted with stride 4. naga rejects that in a `var<uniform>`.

Per the WGSL spec (§4.1.2), a language extension is automatically available wherever the implementation supports it, and `requires X;` only documents the use. So on Dawn/Chrome 144+ (which has `uniform_buffer_standard_layout`) the same output is accepted and silently mis-reads the buffer.

`StructuredBuffer<S, ScalarDataLayout>` on WGSL matches reflection by luck, because WGSL's storage layout is about std430.

`Std140DataLayout`/`Std430DataLayout` give E36107 on WGSL because of `[require(spirv)][require(glsl)]` in hlsl.meta.slang:41-55. `ScalarDataLayout` has no require, so it compiles silently.

Quick naga check: `python3 -m venv /tmp/wv && /tmp/wv/bin/pip install wgpu`. Then use `wgpu.utils.get_default_device().create_shader_module(code=...)`; it works on the L40S Vulkan adapter.
