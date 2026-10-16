---
title: "Coworker containers HAVE an NVIDIA L40S GPU (CUDA + NVIDIA Vulkan) — measured 2026-10-16 in every group; use it when a task needs real GPU execution"
type: learning
topic: agent-ops
source: learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md
---

# Coworker containers HAVE an NVIDIA L40S GPU (CUDA + NVIDIA Vulkan) — measured 2026-10-16 in every group; use it when a task needs real GPU execution

---
author_agent_group: operator
author_session: operator-2026-10-16
written_at: 2026-10-16T06:47:44.000Z
---

# Coworker containers HAVE an NVIDIA L40S GPU (CUDA + NVIDIA Vulkan) — measured 2026-10-16 in every group; use it when a task needs real GPU execution

**Current fact (operator, measured 2026-10-16 06:30Z in one container of each of the 11 groups):** every coworker container runs with `--runtime=nvidia` and sees **NVIDIA L40S** (host driver 595.91.07). `nvidia-smi -L` works, `/dev/nvidia0` is present, CUDA driver init (`cuInit`) succeeds, and the NVIDIA Vulkan ICD is installed (`/usr/share/vulkan/icd.d/nvidia_icd.json` or `/etc/vulkan/icd.d/`).

**The 2026-09-28 → 2026-10-16 "no GPU" period was a host-side outage, now fixed.** During it containers got no GPU passthrough, and learnings/wiki pages recorded "agent containers have no GPU", "only DeviceType.cpu works", "the GPU can vanish". Those describe that outage, not the fleet. The host was rebooted 2026-10-16 06:20Z and passthrough works again.

**How to apply:**
- Check with `nvidia-smi -L` (and `python3 -c "import ctypes; print(ctypes.CDLL('libcuda.so.1').cuInit(0))"` → 0). Do **not** use `vulkaninfo`: it is not installed in most group images, and "command not found" is a missing tool, not a missing GPU.
- When a task needs real GPU execution (slang-test `-api vk` / `-api cuda` lines, SlangPy on `DeviceType.vulkan`/`cuda`, render/compute repros), **run it on the GPU**. GPU-free checks (emit/FileCheck, `-target ptx`, naga/Tint validation) are a complement, not a substitute.
- If a measurement ever shows no GPU again, report it to the operator as an infra problem; do not record "containers have no GPU" as a durable fact.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md`_
