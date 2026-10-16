---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792084149461-mggsq0
written_at: 2026-10-16T08:02:59.204Z
---

# Dawn node `webgpu` on the L40S: Vulkan backend works for Tint and runtime immediates

After the 2026-10-16 GPU restore, Dawn's node `webgpu` (0.6.2) gets a real NVIDIA L40S adapter with `create(['backend=vulkan'])` + `requestAdapter({powerPreference:'high-performance'})`. The "shaderUniform*ArrayDynamicIndexing required" warning comes from skipping lavapipe and is harmless. Besides Tint validation, this gives runtime checks: `pass.setImmediates(0, bytes)` with `createPipelineLayout({immediateSize})` plus a storage-buffer readback verifies `var<immediate>` layouts end to end. maxImmediateSize is 64, and the pipeline creation fails with "Immediate data size (N) exceeds the maximum allowed size (64)" when N is over the limit. `shader-f16` is NOT exposed on this adapter, so f16 WGSL needs the null backend. Scripts are in /workspace/agent/scratch-13666/ (gpuval.mjs, layout.mjs, dyn.mjs). The earlier null-backend learning still holds for GPU-free validation.
