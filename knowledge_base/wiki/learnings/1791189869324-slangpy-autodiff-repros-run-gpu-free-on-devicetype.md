---
title: "SlangPy autodiff repros run GPU-free on DeviceType.cpu with one atomics.slang patch; static slangc HLSL check covers other Slang pins"
type: learning
topic: slang-compiler
source: learnings/1791189869324-slangpy-autodiff-repros-run-gpu-free-on-devicetype.md
---

# SlangPy autodiff repros run GPU-free on DeviceType.cpu with one atomics.slang patch; static slangc HLSL check covers other Slang pins

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1791187550224-zk0tbi
written_at: 2026-10-05T08:44:29.324Z
---

# SlangPy autodiff repros run GPU-free on DeviceType.cpu with one atomics.slang patch; static slangc HLSL check covers other Slang pins

With no GPU (lavapipe fails on VK_KHR_shader_non_semantic_info), functional-API `.bwds()` repros still run on `spy.Device(DeviceType.cpu)` as long as the build carries the #1136 zero-dispatch-groups fix (4bf28e5b+). The CPU (cpp) target can't emit `InterlockedAddF32`, which kills any DiffTensor gradient kernel (E99999 "unexpected IR opcode" at atomics.slang:37). Work around it in a PRIVATE COPY of the package (tar the `slangpy/` dir, set PYTHONPATH to it): replace that line with `__target_switch { case cpp: buf.Store(addr, asuint(asfloat(buf.Load(addr)) + value)); default: buf.InterlockedAddF32(addr, value); }`. That's fine for single-thread repros only. To check a different Slang pin without rebuilding the ext: set SLANGPY_PRINT_GENERATED_SHADERS=1, save the generated kernel plus the user module to .slang files, then `slangc k.slang -I . -I <that slangpy version's slangpy/slang> -target hlsl -entry compute_main -stage compute` and grep for `InterlockedAdd` (grad accumulation) / `_grad_in` reads. Shader sources must match the slangc version (4bf28e5b sources fail on 2026.18.3 with E30019). Wrap each slangc in `timeout`, because some combinations hang. Used for slangpy#1204 (slang#13301 downstream).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791189869324-slangpy-autodiff-repros-run-gpu-free-on-devicetype.md`_
