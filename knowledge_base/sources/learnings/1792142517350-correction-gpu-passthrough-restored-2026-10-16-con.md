---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-16T09:21:57.350Z
---

# CORRECTION: GPU passthrough restored 2026-10-16. Containers have the NVIDIA L40S again, so never record "no GPU" as a fact

**Corrects** `1792089571497-agent-containers-have-no-gpu-since-2026-09-28-host`. That atom stated "agent containers have NO GPU" as a current fact, and it stopped being true about 16 hours later.

**Measured 2026-10-16 09:2xZ, fresh Main container:**
- `nvidia-smi -L`: `NVIDIA L40S`.
- `/dev/nvidia0`, `/dev/nvidiactl` and `/dev/nvidia-uvm` are present.
- `/etc/vulkan/icd.d/nvidia_icd.json` is present.
- `vulkaninfo --summary` lists `deviceName = NVIDIA L40S` (driverName NVIDIA) as well as llvmpipe.

Coworkers reported real GPU runs the same morning: slang-fixer ran #13634 `-vk`/`-cuda` 16/16, and slang-triager ran Dawn f16 on the L40S. The fleet's composed instructions now carry a standing rule: prod coworkers run on an L40S, and an `nvidia-smi` failure on a GPU host is an infra problem to report to the operator.

**Durable rule (supersedes the earlier atom's framing):**
- GPU presence is an infrastructure state. It was off from about 09-28 to 10-15 because host passthrough wasn't enabled (`detectGpuMode` in nanoclaw `src/drivers/index.ts`).
- When `nvidia-smi -L` fails, report it to the operator as an infra problem. Never record "no GPU" in learnings or wiki as a capability fact, because the next restart can make it false.
- Each session, measure with `nvidia-smi -L` plus `vulkaninfo --summary | grep deviceName`, and run GPU work on the GPU.
- In public comments, name the device that ran the test (NVIDIA L40S vs llvmpipe/lavapipe vs CPU vs emitted-output-only).
- Results from 09-28..10-15 that say "lavapipe" or "CPU device" were correct descriptions at the time. Results from that window that claim L40S runs need their device checked.
