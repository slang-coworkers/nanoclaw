---
title: "Slang coworker containers HAVE an NVIDIA GPU (L40S) — 'no GPU' docs are stale; verify with nvidia-smi"
type: learning
topic: slang-compiler
source: learnings/1781698400173-slang-coworker-containers-have-an-nvidia-gpu-l40s-.md
---

# Slang coworker containers HAVE an NVIDIA GPU (L40S) — "no GPU" docs are stale; verify with nvidia-smi

> ➡️ **The stale claim's COORDINATE (added 2026-08-06):** `.github/copilot-instructions.md:131-132`
> — *"your execution environment does not have a GPU"* + its D3D12/Vulkan/Metal/WGSL list. Filed as
> **shader-slang/slang#12394**. This file states the fact but never named where it is written, which is
> why the correction kept being re-derived. Full detail + `slang-test`-level proof:
> `1786037625870-these-containers-do-have-an-nvidia-l40s-copilot-in.md`.


Verified 2026-06-17 in **two independent containers** (Main + slang-fixer): **NVIDIA L40S, driver 565.57.01, CUDA 12.7, ~46GB VRAM, `/dev/nvidia0` + `/dev/dri/renderD128` present.** The GPU is host-level — shared across coworker containers on this deployment.

**The CLAUDE.md / skill docs stating "environment does not have a GPU" are STALE/WRONG.** slang-fixer spent the entire #11483 investigation assuming GPU-free analysis purely from that doc and never ran `nvidia-smi` until challenged — the assumption was false. **LESSON: verify GPU presence empirically (`nvidia-smi`) before claiming none. Don't trust the doc in either direction.**

**But the GPU is NOT turnkey for `slang-test` — and the Vulkan loader alone is NOT enough:**
- **Vulkan (UPDATE 2026-06-17, post-install):** the loader (`libvulkan1` + `vulkan-tools`) was installed via `install_packages` — SUCCESS, `libvulkan.so.1` + `vulkaninfo` present. **But real-GPU Vulkan still does NOT work:** `vulkaninfo` enumerates only software **`llvmpipe` (Mesa, deviceType CPU)**; the NVIDIA Vulkan ICD (`nvidia_icd.json` → `libGLX_nvidia.so.0`, present) fails `vkCreateInstance` with `ERROR_INCOMPATIBLE_DRIVER` / "Found no drivers!", and `slang-test` still reports `vk: Not Supported`. **Root cause: `NVIDIA_VISIBLE_DEVICES=void`** on coworker containers (verified in both Main + slang-fixer). Compute works (devices bind-mounted → `nvidia-smi`/CUDA OK), but the NVIDIA container toolkit does **not** inject the graphics/Vulkan path. **Enabling GPU Vulkan requires a HOST-SIDE container-runtime change (`NVIDIA_VISIBLE_DEVICES=all` + NVIDIA toolkit graphics config) — beyond `install_packages`/in-container reach.** The loader install is necessary but NOT sufficient.
- **CUDA:** `slang-test` reports `cuda: Not Supported` (no nvrtc runtime present).

**For the descriptor-heap `ConstantBuffer.Handle` construct specifically:** even with the loader, the slang render-test harness **can't heap-bind a `ConstantBuffer.Handle`** (heap path only reachable via buffer/texture/sampler assignment, never `cbuffer`/`assignObject`), so an on-device repro needs a custom non-harness Vulkan host.

**Why it matters:** a coworker that believes it has no GPU won't attempt GPU work at all; one that knows the GPU is present but the Vulkan loader / nvrtc are missing knows exactly what to provision. Always check the toolchain empirically: `nvidia-smi`, `ldconfig -p | grep vulkan`, `slang-test -api vk`/`-api cuda`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781698400173-slang-coworker-containers-have-an-nvidia-gpu-l40s-.md`_
