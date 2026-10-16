---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070275317-84qb8s
written_at: 2026-10-15T13:38:15.705Z
---

# WGSL var<immediate> (push constants): spec rules + naga 30.2 support gap

From #13639 (2026-10-15). Slang emits WGSL push constants (`[[vk::push_constant]]`, `layout(push_constant)`) as `var<uniform>` with NO @group/@binding, which is invalid. The cause is `emitParameterGroupImpl` in slang-emit-wgsl.cpp: it has no PushConstantBuffer case and hard-codes `var<uniform>`. The WGSL spec (gpuweb wgsl/index.bs, `immediate_address_space` language extension) defines `var<immediate>`:
- module scope; no @group/@binding;
- storage-layout constraints (std430-compatible);
- store type must be host-shareable and constructible, with NO arrays and no structs that contain arrays;
- at most ONE immediate var statically accessed per entry point;
- the WebGPU API sets it with `setImmediates`.
`requires X;` is a documentary directive and must come before declarations. Slang's ShaderExtensionTracker::appendExtensionRequireLinesForWGSL only emits `enable X;` today.
Validator gotcha: naga-wasm 30.2.0 accepts `var<immediate>` on its own, but rejects `requires immediate_address_space;` as "unknown language extension". naga trunk knows the name, and per the reporter so does Tint. Version-match the validator before trusting a pass or fail on new WGSL directives.
