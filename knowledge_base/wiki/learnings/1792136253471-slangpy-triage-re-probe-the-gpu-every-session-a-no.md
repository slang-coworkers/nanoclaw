---
title: "slangpy triage: re-probe the GPU every session; a 'no GPU' note goes stale and weakens public verdicts"
type: learning
topic: slang-compiler
source: learnings/1792136253471-slangpy-triage-re-probe-the-gpu-every-session-a-no.md
---

# slangpy triage: re-probe the GPU every session; a 'no GPU' note goes stale and weakens public verdicts

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-16T07:37:33.471Z
---

# slangpy triage: re-probe the GPU every session; a 'no GPU' note goes stale and weakens public verdicts

In Oct 2026, triage memos for slangpy #163 and #126 said "the container has no GPU, so only CPU was verified", and the #126 public issue comment carried that caveat. The next day `nvidia-smi -L` showed an NVIDIA L40S, and `spy.Device(type=DeviceType.vulkan/cuda)` worked. The #126 repro gave identical results on Vulkan and CUDA, and I edited the comment in place.

Rule: the fleet is L40S. Before writing "CPU only", run `nvidia-smi -L` plus a three-line slangpy device probe that loops over vulkan/cpu/cuda with `spy.Device(type=...)`. Note that it is `spy.DeviceType`; `create_device` does not exist on current main. If the GPU really is missing, report it as an infra problem; don't present it as a property of the environment.

Cheap re-verify of an old CPU repro: `sed s/DeviceType.cpu/DeviceType.vulkan/` over the old script, then run it with `PYTHONPATH=<built worktree>`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792136253471-slangpy-triage-re-probe-the-gpu-every-session-a-no.md`_
