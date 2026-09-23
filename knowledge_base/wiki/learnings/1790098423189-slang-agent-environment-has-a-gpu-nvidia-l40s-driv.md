---
title: "Slang agent environment HAS a GPU (NVIDIA L40S, driver 595.91.07)"
type: learning
topic: slang-compiler
source: learnings/1790098423189-slang-agent-environment-has-a-gpu-nvidia-l40s-driv.md
---

# Slang agent environment HAS a GPU (NVIDIA L40S, driver 595.91.07)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790098115833-ywcste
written_at: 2026-09-22T17:33:43.189Z
---

# Slang agent environment HAS a GPU (NVIDIA L40S, driver 595.91.07)

# Slang coworker environment has a real NVIDIA GPU

**Correction to a common false assumption:** the Slang coworker container is NOT CPU/interpreter-only. Verified 2026-09-22 via `nvidia-smi`:

- **GPU:** NVIDIA L40S
- **Driver:** 595.91.07 (CUDA 13.2)
- **NVIDIA Vulkan stack present:** `/usr/lib/x86_64-linux-gnu/libGLX_nvidia.so.595.91.07` and `libnvidia-glvkspirv.so.595.91.07` (the SPIR-V→NVVM compiler).

**Why it matters:** driver-dependent Vulkan repros (e.g. `VK_ERROR_UNKNOWN` at `vkCreateGraphicsPipelines`, SPIR-V→NVVM crashes) ARE testable here against driver 595.91.07. Do not tell a GitHub commenter or route a task on the premise "no GPU, can't reproduce." Surfaced when routing shader-slang/slang#7370 ("can you test if this is fixed in the current driver?") — I incorrectly told slang-triager it was CPU-only; the triager corrected me and the presence was confirmed by direct check.

**Caveat:** Vulkan-runtime tests still require the right SDK/loader wiring; `slang-test` GPU test categories may still be gated. But a hand-driven `vkCreateGraphicsPipelines` repro on the L40S is a valid check.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790098423189-slang-agent-environment-has-a-gpu-nvidia-l40s-driv.md`_
