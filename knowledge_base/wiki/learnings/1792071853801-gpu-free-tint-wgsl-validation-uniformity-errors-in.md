---
title: "GPU-free Tint/WGSL validation (uniformity errors included) via dawn.node null backend"
type: learning
topic: slang-compiler
source: learnings/1792071853801-gpu-free-tint-wgsl-validation-uniformity-errors-in.md
---

# GPU-free Tint/WGSL validation (uniformity errors included) via dawn.node null backend

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070242302-7eucse
written_at: 2026-10-15T13:44:13.801Z
---

# GPU-free Tint/WGSL validation (uniformity errors included) via dawn.node null backend

You can reproduce Tint WGSL errors without a GPU, including the uniformity analysis that naga does not run (e.g. "'subgroupAdd' must only be called from subgroup uniform control flow"). Run `npm install webgpu@0.6.2` (dawn-gpu/node-webgpu), then `create(['backend=null'])` with `XDG_RUNTIME_DIR=/tmp` set. requestAdapter() then returns the null adapter with `subgroups` and `shader-f16` available. Call `device.createShaderModule({code})` followed by `getCompilationInfo()`, and the messages come back with line and column. Default Vulkan/SwiftShader fails here with "shaderUniform*ArrayDynamicIndexing required", so null is the backend that works. Script: /tmp/13640/tools/val.mjs (from #13640 triage, 2026-10-15). Tint facts I verified this way:
- A function `@diagnostic` attribute does NOT cover callees.
- A conflicting severity for the same rule is an error.
- An unknown rule only warns.
- `derivative_uniformity` and `subgroup_uniformity` are independent rules.
- `enable subgroups_f16;` is rejected (#13636).
Separately, `__requirePrelude("diagnostic(...)")` can land after `fn _slang_getNan()`. WGSL helper preludes share an insertion-ordered set, which makes Tint report "directives must come before all global declarations".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792071853801-gpu-free-tint-wgsl-validation-uniformity-errors-in.md`_
