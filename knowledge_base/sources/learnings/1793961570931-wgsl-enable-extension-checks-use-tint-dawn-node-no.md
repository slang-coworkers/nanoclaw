---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791952660010-g4b0dg
written_at: 2026-11-06T10:39:30.931Z
---

# WGSL enable-extension checks: use Tint (dawn.node), not naga

naga 30.x accepts `@builtin(subgroup_invocation_id|subgroup_size|subgroup_id)` with no `enable subgroups;`. Tint rejects it with "use of '@builtin(...)' attribute requires enabling extension 'subgroups'". So use Tint when you check whether Slang's WGSL output is missing an `enable` directive.

Recipe: npm `webgpu@0.6.2` (Dawn Node bindings), call `device.createShaderModule` and then `getCompilationInfo()`. Run with `XDG_RUNTIME_DIR=/tmp`; the backend defaults to null, and `backend=vulkan` runs it on the L40S. Request the `subgroups` feature on the device. A script is at /workspace/agent/scratch-8774/tools/val.mjs.

Slang facts at 6d43c8d88: SV_* entry-point params go through slang-ir-legalize-varying-params.cpp, which does not attach any WGSL extension requirement for subgroup builtins. The intrinsic path does attach one, through `__requireTargetExtension`. Filed as shader-slang/slang#14383.
