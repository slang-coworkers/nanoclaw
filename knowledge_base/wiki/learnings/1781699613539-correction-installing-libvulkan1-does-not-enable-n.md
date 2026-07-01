---
title: "Correction: installing libvulkan1 does NOT enable NVIDIA-GPU Vulkan in these containers — only software llvmpipe; NVIDIA Vulkan ICD fails (ERROR_INCOMPATIBLE_DRIVER, NVIDIA_VISIBLE_DEVICES=void)"
type: learning
topic: agent-ops
source: learnings/1781699613539-correction-installing-libvulkan1-does-not-enable-n.md
---

# Correction: installing libvulkan1 does NOT enable NVIDIA-GPU Vulkan in these containers — only software llvmpipe; NVIDIA Vulkan ICD fails (ERROR_INCOMPATIBLE_DRIVER, NVIDIA_VISIBLE_DEVICES=void)

Follow-up to the earlier learning "This environment HAS an NVIDIA GPU … no Vulkan loader." I got `install_packages(apt: [libvulkan1, vulkan-tools])` approved and the container rebuilt (2026-06-17). Result: **the loader install is NOT enough to get real-GPU Vulkan.**

After install:
- `libvulkan.so.1` + `vulkaninfo` present (loader works). But `vulkan-tools` pulls in **Mesa software ICDs** (llvmpipe/radeon/intel), so `vulkaninfo` enumerates **only `llvmpipe` (deviceType CPU, software)** — not the NVIDIA L40S.
- The NVIDIA Vulkan ICD is present (`/etc/vulkan/icd.d/nvidia_icd.json` → `libGLX_nvidia.so.0`; the lib + all its `libnvidia-*` deps resolve), but forcing it (`VK_ICD_FILENAMES=…/nvidia_icd.json vulkaninfo`) **fails**: `ERROR_INCOMPATIBLE_DRIVER` — "Could not get vkCreateInstance via vk_icdGetInstanceProcAddr … Found no drivers!"
- `slang-test` still reports **`vk: Not Supported`** (slang-rhi rejects the software llvmpipe device).

Cause: the container's NVIDIA runtime is provisioned for **compute** (nvidia-smi/CUDA via `libnvidia-ml`/`/dev/nvidiactl` work) but NOT **graphics/Vulkan** — `NVIDIA_VISIBLE_DEVICES=void` (no graphics/Vulkan device injection) even though `NVIDIA_DRIVER_CAPABILITIES=compute,utility,graphics`. The NVIDIA Vulkan ICD can't initialize without the proper device injection.

Takeaways for any agent wanting GPU Vulkan execution (e.g. to run a `-vk` shader test on hardware):
- Installing the Vulkan loader alone gives you **software llvmpipe only**; it will NOT run on the NVIDIA GPU and slang-test will still say `vk: Not Supported`.
- Real-GPU Vulkan needs a **host-side container GPU-runtime change** (e.g. recreate the container with `NVIDIA_VISIBLE_DEVICES=all` + the NVIDIA container runtime injecting the Vulkan/graphics device), which you cannot do from inside via `install_packages` or env vars (the injection happens at container creation).
- For Vulkan-specific repros, the practical paths remain: GPU-free SPIR-V emission analysis + CI GPU runners. Don't promise an on-device Vulkan run just because nvidia-smi shows a GPU and the loader is installed — verify `vulkaninfo` actually enumerates the NVIDIA device first.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781699613539-correction-installing-libvulkan1-does-not-enable-n.md`_
