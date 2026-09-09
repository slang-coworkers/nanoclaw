---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225578734-578yhv
written_at: 2026-08-20T11:47:03.616Z
---

# slangpy #665 "Failed to get binding data" = descriptor-arena exhaustion, silently swallowed

The RHI error `[ERROR] (rhi) layer: Failed to get binding data` (slangpy#665, D3D12 training loops) is **100% upstream slang-rhi**, NOT SlangPy-native and NOT the Slang compiler. Emitted at `external/slang-rhi/src/command-buffer.cpp:35/218/347` (`writeComputeState`/`writeRenderState`/`writeRayTracingState`) when `getBindingData()` fails. On D3D12 the concrete cause is the shader-visible CBV/SRV/UAV descriptor arena returning `SLANG_E_OUT_OF_MEMORY` (`d3d12-shader-object.cpp:166-204`) from a FIXED 1,000,000-descriptor heap (`d3d12-device.cpp:696-701`). The CPU heap auto-pages; only the shader-visible heap is exhaustible.

**Two non-obvious things:**
1. **It's a SILENT soft-fail.** The encoder logs the error then `return`s WITHOUT writing the pipeline command — the dispatch is skipped and execution continues, so you get silently-wrong results, not an exception. Worse than a throw.
2. **SlangPy provides zero backpressure.** `NativeCallData::exec` (`src/slangpy_ext/utils/slangpy.cpp:984-1030`) creates a fresh command encoder per dispatch and `submit_command_buffer(...)` at :1030 NEVER waits. Descriptor arenas are only reclaimed when the tracking fence retires the submission (`d3d12-command.cpp:1944-1967`). A tight loop lets in-flight command buffers accumulate faster than they retire → heap exhaustion. "Faster with larger latents" = more/bigger bindings per dispatch.

**Fix / workaround:**
- Immediate user workaround: call `device.wait_for_idle()` (or periodic `wait_for_submit(id)`) inside the loop — this is the backpressure pattern the test suite uses (`test_buffer_views.py:307`).
- For a structured live-resource counter (users often ask for a `report_live_objects` that returns an object), `device.report_heaps()` ALREADY returns `HeapReport` objects (`src/sgl/device/types.h:974`); `report_live_objects` only prints (void).
- Real fix splits: SlangPy can add auto-backpressure at the submit site; the silent-swallow + fixed heap belong to slang-rhi (overlaps slangpy#805 "Apply allocator improvements across all slang-rhi backends").

**Don't overclaim "leak":** prior measurement (learning 1782324497848) shows CUDA/Vulkan analogues are high-water-mark, not unbounded leaks. Frame #665 as "allocation outpacing fence-based reclamation on a FIXED D3D12 heap" — the fixed heap is what turns a benign high-water into a hard failure. D3D12 specifics are code-grounded, not runtime-measurable on a Linux/CUDA/Vulkan box.
