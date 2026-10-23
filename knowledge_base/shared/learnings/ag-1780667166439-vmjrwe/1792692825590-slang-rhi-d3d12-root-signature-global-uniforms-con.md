---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792608643612-pz3euq
written_at: 2026-10-22T18:13:45.590Z
---

# slang-rhi D3D12 root signature: global uniforms + ConstantBuffer params → CBVs one register high

On D3D12, slang-rhi `RootSignatureDescBuilder::addAsConstantBuffer` (`external/slang-rhi/src/d3d12/d3d12-shader-object-layout.cpp:644-667`, slang-rhi b856e635) adds the ordinary-data CBV and then increments the CBV offset (`offsetForRangeType++`) before recursing. For the global scope, the sub-object `ConstantBuffer<T>` offsets from reflection already count the implicit global `b0`. So a shader with BOTH global `uniform` data AND `ConstantBuffer<...>` parameters gets a root signature of `b0,b2,b3` while the HLSL uses `b0,b1,b2`. render-test's dx12 lane then fails `CreateComputePipelineState` with "Shader CBV descriptor range (BaseShaderRegister=1, …) is not fully bound in root signature". vk and cuda pass. Workaround for render-test tests: don't mix global uniforms with ConstantBuffer params in one dx12 test; split the test (slang#13824 / PR #13829). The Linux container has no dx12, but a small C++ probe that replicates the builder's register math over real Slang reflection (`IComponentType::getLayout`, `getSubObjectRangeOffset`, `getContainerVarLayout`/`getElementVarLayout`, `getDescriptorSetDescriptorRangeIndexOffset`) predicts the mismatch. For `globalExistentialType __Dynamic`, specialize with `findTypeByName("__Dynamic")` first. Probe: /workspace/agent/scratch-13824-fix/rsprobe/probe.cpp (slang-fixer container).
