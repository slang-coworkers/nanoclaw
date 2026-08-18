---
title: "This environment HAS an NVIDIA GPU (nvidia-smi works) despite CLAUDE.md saying 'no GPU' — but no Vulkan loader, so Vulkan execution still unavailable"
type: learning
topic: misc
source: learnings/1781698311286-this-environment-has-an-nvidia-gpu-nvidia-smi-work.md
---

# This environment HAS an NVIDIA GPU (nvidia-smi works) despite CLAUDE.md saying "no GPU" — but no Vulkan loader, so Vulkan execution still unavailable

Observed 2026-06-17 on shader-slang/slang#11483 when a maintainer said "you should have a GPU." CLAUDE.md / copilot-instructions state "your execution environment does not have a GPU," and many prior runs asserted "no GPU" **from that doc alone, never running nvidia-smi**. That assumption is WRONG.

**Actual state (verify yourself; don't trust the doc):**
- `nvidia-smi` → **NVIDIA GPU present**, driver 565.57.01, CUDA 12.7. `/dev/nvidia0`, `/dev/nvidiactl`, `/dev/dri/renderD128` all exist. `libcuda.so.1` present.
- **BUT Vulkan is NOT runnable:** the NVIDIA Vulkan **ICD** manifest is there (`/etc/vulkan/icd.d/nvidia_icd.json` + `libnvidia-glvkspirv.so`), yet the Vulkan **loader** `libvulkan.so.1` is **absent** (`ldconfig -p | grep vulkan` → nothing; no `/usr/share/vulkan`; `vulkaninfo` not installed). So `slang-test` reports `vk,vulkan: Not Supported`, and any `-vk` execution test is ignored.
- **CUDA backend also Not Supported** in slang-test (libcuda present but no `libnvrtc` / CUDA toolkit) → `cuda: Not Supported`.

**Implications:**
- Don't claim "no GPU" from the doc — run `nvidia-smi` + `ls /dev/nvidia*`. The hardware is there.
- For **Vulkan**-specific repros (e.g. `spvDescriptorHeapEXT`, SPIR-V GPU execution), the GPU alone isn't enough — you'd need to `install_packages(apt: [libvulkan1, vulkan-tools, ...])` (admin-gated, image rebuild) to get the loader; the NVIDIA ICD is already present, so the loader should then light up `-vk`.
- For CUDA execution you'd similarly need the CUDA toolkit/nvrtc.
- Until those are installed, `slang-test`/render-test still can't run `-vk`/`-cuda` here — GPU-free SPIR-V emission analysis + CI GPU runners remain the practical paths, but say so accurately ("Vulkan loader not installed"), not "no GPU."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781698311286-this-environment-has-an-nvidia-gpu-nvidia-smi-work.md`_
