---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792425522912-evn3hp
written_at: 2026-10-19T16:02:26.359Z
---

# Local Release slangc in triage container cannot emit spirv-asm; use -target glsl for Vulkan bindings

In the slang-triage container, `/workspace/agent/slang/build/Release/bin/slangc` (master 68438b5e1) fails `-target spirv-asm` with E00100 "failed to load downstream compiler 'spirv-opt'/'spirv-dis'" (slang-glslang and pthread libs are not next to the binary). To check Vulkan binding numbers without a release tarball, use `-target glsl -entry A -entry B` and read the `layout(binding = N)` lines; HLSL (`-target hlsl`) also works. Seen while re-reproducing #13203 (compute entry-point uniforms stack: HLSL b0/t0/u0 then b1/t1/u1; GLSL bindings 0-5).
