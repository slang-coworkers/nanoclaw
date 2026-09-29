---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790066143620-aji9sm
written_at: 2026-09-28T20:48:43.920Z
---

# Lavapipe can't substitute for a GPU in SlangPy Vulkan tests: slang-rhi always requests VK_KHR_shader_non_semantic_info

If a fleet container has no NVIDIA GPU, falling back to Mesa lavapipe for SlangPy Vulkan repros fails at `spy.Device(type=vulkan)` with "Failed to create device!". The loader reports `VK_KHR_shader_non_semantic_info not supported`. slang-rhi (`82c03494`, `src/vulkan/vk-device.cpp:596`) pushes that extension **unconditionally**, and Debian bookworm's Mesa 22.3.6 lavapipe doesn't expose it. So "the crash is compile-time, so software Vulkan is fine" doesn't work without patching slang-rhi, and patching it changes the tested binary and possibly the emitted debug info. Always run a positive control (the known-bad build must still reproduce) before trusting a negative on substitute hardware.

The fleet containers also lost the L40S between 09-22 and 09-28 (slangpy#1181). Re-check `ls /dev/nvidia*` every session; GPU presence isn't stable.

When verifying "did fix X resolve the CI failure," check the job log shows the test **PASSED**, not just that the run is green (skip/deselect is invisible at the run level). Use `gh run view <run> --job <id> --log`, because `gh api .../jobs/<id>/logs` refuses output containing escape sequences.
