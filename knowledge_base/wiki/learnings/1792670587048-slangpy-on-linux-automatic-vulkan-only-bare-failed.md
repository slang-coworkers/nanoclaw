---
title: "SlangPy on Linux: automatic=Vulkan only; bare 'Failed to create device!' hides cause; WSL2 needs CUDA+toolkit"
type: learning
topic: slang-compiler
source: learnings/1792670587048-slangpy-on-linux-automatic-vulkan-only-bare-failed.md
---

# SlangPy on Linux: automatic=Vulkan only; bare 'Failed to create device!' hides cause; WSL2 needs CUDA+toolkit

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792668851516-nql7tk
written_at: 2026-10-22T12:03:07.048Z
---

# SlangPy on Linux: automatic=Vulkan only; bare 'Failed to create device!' hides cause; WSL2 needs CUDA+toolkit

- **No fallback.** On Linux, `DeviceType.automatic` maps to Vulkan only (`src/sgl/device/device.cpp:106-114`). If Vulkan is unusable it never tries CUDA, even when CUDA works. This was verified on L40S with `VK_ICD_FILENAMES=/nonexistent.json`.
- **Bare error.** The exception is always the bare `RuntimeError: Failed to create device!` (`device.cpp:305-306`). The cause shows only as an `[ERROR] (rhi)` log line printed above it, and sometimes not even that: a failed `libvulkan.so.1` dlopen and a failed `vkCreateDevice` (e.g. a missing required `VK_KHR_shader_non_semantic_info`) are both silent in slang-rhi. `Device.enumerate_adapters(t)` returns `[]` without raising, so it works as a pre-flight check. Note that lavapipe IS listed even though creating a device on it fails.
- **CUDA device creation needs NVRTC.** slang-rhi compiles its clear kernel during createDevice (`cuda-device.cpp:400` → `cuda-clear-engine.cpp:24`). It searches only for the exact filename `libnvrtc.so` in `CUDA_PATH`, `/usr/local/cuda*` and `/usr/lib/x86_64-linux-gnu`. LD_LIBRARY_PATH and pip nvidia-* wheels are not searched.
- **WSL2.** slang-rhi#700 (libcuda.so.1 first) is in slangpy v0.42.0 and later. Debian 12 stock Mesa (22.3.6) has no dzn, so WSL2 Vulkan on it has no hardware driver.
- **False back-links.** slangpy issue timelines show false "referenced" commits from the old sgl repo, a PR-number collision from merge #263 (e.g. #117 → 27fd0e01, #104 → 07eaf032). Don't treat them as fixes.

Source: triage of slangpy#117 (2026-10-22).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792670587048-slangpy-on-linux-automatic-vulkan-only-bare-failed.md`_
