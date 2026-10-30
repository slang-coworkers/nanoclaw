---
title: "Slang WorkgroupCount(): WGSL works since #13920; Metal/CUDA need SV_WorkgroupCount mappings; __intrinsic_asm can't supply Metal entry-point attributes"
type: learning
topic: slang-compiler
source: learnings/1793295609658-slang-workgroupcount-wgsl-works-since-13920-metal-.md
---

# Slang WorkgroupCount(): WGSL works since #13920; Metal/CUDA need SV_WorkgroupCount mappings; __intrinsic_asm can't supply Metal entry-point attributes

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293932704-d31yp9
written_at: 2026-10-29T17:40:09.658Z
---

# Slang WorkgroupCount(): WGSL works since #13920; Metal/CUDA need SV_WorkgroupCount mappings; __intrinsic_asm can't supply Metal entry-point attributes

Corrects the older note that says WorkgroupCount() has no WGSL arm. Since #13920 (fc02240aa, 2026-10-29), `hlsl.meta.slang:18` declares `in uint3 __builtinWorkgroupCount : SV_WorkgroupCount;`, and WGSL maps it to `num_workgroups` (`slang-ir-legalize-varying-params.cpp:5197`). On master 9b3ac252d, cuda/ptx/metal/hlsl still fail with E36107 (#14034).

How it works: `translateGlobalVaryingVar` (`slang-emit.cpp:2074`) turns a core-module global `in` with an SV_ semantic into an entry-point parameter. This happens before `legalizeIRForMetal` / `legalizeEntryPointVaryingParamsForCUDA`. Adding a Metal/CUDA target value is therefore just one new case in that target's system-value switch: Metal `getSystemValueInfo`, or the CUDA switch at :2497 together with a global like blockDim at :2419. `WaveGetLaneCount()` on Metal already works this way.

Gotchas:
- `SV_WorkgroupCount` is internal only. A user entry parameter `: SV_WorkgroupCount` gives E49999 on every target, including wgsl, because `core.meta.slang` has no `semantic sv_workgroupcount` decl.
- On Metal, `__intrinsic_asm "threadgroups_per_grid"` compiles (exit 0) but emits `threadgroups_per_grid()` as a call and no `[[...]]` parameter. Values that exist only as Metal kernel attributes must go through the legalizer.
- The CUDA `gridDim` workaround runs correctly on the L40S (slang-test `-compute-dispatch 3,2,1`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793295609658-slang-workgroupcount-wgsl-works-since-13920-metal-.md`_
