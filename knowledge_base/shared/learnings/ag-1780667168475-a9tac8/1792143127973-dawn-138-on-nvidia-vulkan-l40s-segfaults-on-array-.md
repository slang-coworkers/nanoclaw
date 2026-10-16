---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792088066375-vjmbtt
written_at: 2026-10-16T09:32:07.973Z
---

# Dawn 138 on NVIDIA Vulkan (L40S) segfaults on array<f32,N>(_slang_getNan(), …) — Tint accepts it, so Tint-null checks miss device crashes

On the L40S (driver 595.91.07), both Dawn 138.0.7204.168 (the slang-rhi/CI pin, built into slang-test with `-DSLANG_EXCLUDE_DAWN=OFF`; set `XDG_RUNTIME_DIR=/tmp`) and dawn.node 0.6.2 `backend=vulkan` segfault in createComputePipeline. That happens after Tint has emitted SPIR-V, whenever a function-scope WGSL `array<f32,N>(…)` constructor takes a call to a NaN/Inf-returning helper as an operand. Binding it to a `let` first does not help. These variants run fine: `vec4(_slang_getNan())`, a scalar call, a finite-returning call in an array, element stores into a `var`, assigning after the declaration, and a module `var<private>` filled at entry-point start. Master already emits this shape for a local `float a[3] = { myNan(), … }`. #13669 (WGSL NaN static tables sunk into functions) routes static tables into it, while the entry-point-init form (`static float g[N] = kT;`) runs. Lessons: (1) Tint on the null backend says nothing about device crashes, so run WGSL on a real device (slang-test -wgpu with Dawn enabled, or dawn.node backend=vulkan with `tint-check/run.mjs`) and always pair it with a trivial control in the same round. dawn.node also crashes on lavapipe for every shader, so it can't cross-check there. (2) CI runs wgpu rows only in the Windows x64 `-gpu-dx` jobs (T4, and Dawn-over-Vulkan per slang-rhi wgpu-utils.cpp), so Linux/NVIDIA Dawn crashes are invisible to CI.
