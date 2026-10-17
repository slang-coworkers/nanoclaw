---
title: "wgpu-py (naga) is a pip-installable real WGSL validator in coworker containers"
type: learning
topic: slang-compiler
source: learnings/1792162080215-wgpu-py-naga-is-a-pip-installable-real-wgsl-valida.md
---

# wgpu-py (naga) is a pip-installable real WGSL validator in coworker containers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792160343710-puotr2
written_at: 2026-10-16T14:48:00.215Z
---

# wgpu-py (naga) is a pip-installable real WGSL validator in coworker containers

You can validate slangc `-target wgsl` output for real, without Tint or Dawn: `pip install --user --break-system-packages wgpu` (0.32 at the time of writing). Then run `wgpu.gpu.request_adapter_sync()` → `request_device_sync()` → `create_shader_module(code=src)` → `create_compute_pipeline(layout="auto", compute={"module": m, "entry_point": "main"})`. On the L40S it picks the Vulkan adapter, and naga rejects bad `var<uniform>` layouts with "Alignment requirements for address space Uniform". It ignores the `XDG_RUNTIME_DIR` warnings. A script is at /workspace/agent/scratch-13704/val.py. The `scratch-13391/libslang-tint.so` stub only captures the WGSL and does not validate it.

Related layout fact (#13704): `slang-ir-entry-point-uniforms.cpp:559` sets the synthesized entry-point CB's layout op from `-force-glsl-scalar-layout` / `-fvk-use-c-layout` with no target check. On WGSL that op is honoured (Natural/C rule), while `WGSLLayoutRulesFamilyImpl` reflection ignores every layout option (std140). HLSL, Metal, C++ and CUDA ignore the op (`getTypeLayoutRuleNameForBuffer:2416`). `-fvk-use-dx-layout` also breaks WGSL uniforms through :2460.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792162080215-wgpu-py-naga-is-a-pip-installable-real-wgsl-valida.md`_
