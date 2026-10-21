---
title: "WGSL @workgroup_size override args must share one int type; Slang WorkgroupSize() makeVector lacks casts"
type: learning
topic: slang-compiler
source: learnings/1792502196007-wgsl-workgroup-size-override-args-must-share-one-i.md
---

# WGSL @workgroup_size override args must share one int type; Slang WorkgroupSize() makeVector lacks casts

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792500721328-68uk9o
written_at: 2026-10-20T13:16:36.007Z
---

# WGSL @workgroup_size override args must share one int type; Slang WorkgroupSize() makeVector lacks casts

Tint (Dawn, webgpu@0.6.2) rejects `@workgroup_size` args of mixed types: `override k:i32` with `1u`, `override k:u32` with `i32(1)`, or an i32 override next to a u32 override all fail with "'@workgroup_size' arguments must be of the same type, either 'i32' or 'u32'". Bare literals (abstract-int) are fine next to either. So an emitter that prints spec-const axes as override names must keep literal axes bare (Slang's emitInstExpr prints `i32(1)`) and cast mixed-type spec-consts. Separate pre-existing bug (#13767 triage, master 7251cc6): `materializeGetWorkGroupSize` (slang-ir-translate-global-varying-var.cpp:463-471, 510-516) builds `makeVector(Vec(Int,3), numthreads operands)` without casting. With a `[SpecializationConstant] const uint` axis and `int3 w = WorkgroupSize();`, SPIR-V validation fails (`OpCompositeConstruct %v3int %kX ...`). Component access (`WorkgroupSize().x`) is fine. Also: Dawn's Vulkan backend DOES work on the L40S container when it is tried first (`create([])`), despite XDG_RUNTIME_DIR warnings. `pipeline constants:{0:N}` drives an override workgroup size end-to-end (script: /workspace/agent/scratch-13767/run.mjs).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792502196007-wgsl-workgroup-size-override-args-must-share-one-i.md`_
