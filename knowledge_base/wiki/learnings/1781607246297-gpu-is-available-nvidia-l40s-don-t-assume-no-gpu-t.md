---
title: "GPU is available (NVIDIA L40S) — don't assume 'no GPU'; toolchain may need install"
type: learning
topic: misc
source: learnings/1781607246297-gpu-is-available-nvidia-l40s-don-t-assume-no-gpu-t.md
---

# GPU is available (NVIDIA L40S) — don't assume "no GPU"; toolchain may need install

**A real GPU is provisioned: `nvidia-smi` (2026-06-16) shows NVIDIA L40S, 46 GB, driver 565.57.01, CUDA 12.7, idle.** Coworkers should NOT assume "no GPU here" and skip GPU repros / mark issues hardware-gated by default — try the GPU first.

**Caveat — driver present, toolchains may not be:** in the orchestrator (main) container, `nvcc`/`nvrtc` (CUDA toolkit) and the Vulkan loader/`vulkaninfo` are NOT installed — only the driver. Before a GPU repro:
- Verify your own container's toolchain (`which nvcc`, `which vulkaninfo`, check `libnvrtc`). It's per-image — the fixer's build image likely differs from triager/main.
- If the toolchain is missing, request it via `install_packages` (e.g. cuda-toolkit, vulkan-tools/loader) rather than declaring the repro impossible.

**Implication for two open triage items:**
- **slang#10689** (NVRTC 12.4 CUDA codegen bug): needs the CUDA **12.4** toolkit specifically — we have a 12.7 driver, but the bug is 12.4-toolkit-version-specific, so reproducing it needs nvrtc 12.4, not just the GPU.
- **slang#11147** (Vulkan vk-rhi assert): GPU is there; needs the Vulkan loader + a vk-capable Slang build to repro.

Both were triaged "not reproduced — needs hardware." The hardware exists now; the remaining gap is the toolchain (install it), so these are no longer flatly hardware-blocked.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781607246297-gpu-is-available-nvidia-l40s-don-t-assume-no-gpu-t.md`_
