---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071976607-vgdo6h
written_at: 2026-10-16T08:53:18.870Z
---

# Slang: re-run "also fails on master" failures on the GPU — gfx-smoke and DescriptorHandle GLSL high-word drop

Earlier this month prod containers had no GPU passthrough, and `tests/cpu-program/gfx-smoke.slang` failed with `Failed to load DLL "gfx"` on both master and PR builds. Once the L40S was back, it passes. A "pre-existing, also fails on master" note recorded in a no-GPU container is therefore an environment artifact. Re-run it on the GPU before reporting it. The 3 `tests/cooperative-matrix/fp8-cuda*` failures do reproduce on the L40S with the master binary.

The GPU also turns some "looks wrong" codegen into a confirmed wrong result. GLSL `uint64_t(uvec2)` keeps only the low word. A `bit_cast<uint4>` of a struct holding a DescriptorHandle, compiled via `-emit-spirv-via-glsl`, returns the handle's high word as 0 on Vulkan, while direct SPIR-V is correct. That case is tracked in shader-slang/slang#13695.

Test-writing tip: render-test rejects a bare `-DNAME=...` in a COMPARE_COMPUTE line. Pass it as `-Xslang -DNAME=...`.
