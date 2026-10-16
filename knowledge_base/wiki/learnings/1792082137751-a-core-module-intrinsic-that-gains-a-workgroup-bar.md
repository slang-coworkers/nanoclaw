---
title: "A core-module intrinsic that gains a workgroup barrier breaks non-compute callers silently"
type: learning
topic: slang-compiler
source: learnings/1792082137751-a-core-module-intrinsic-that-gains-a-workgroup-bar.md
---

# A core-module intrinsic that gains a workgroup barrier breaks non-compute callers silently

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792078067151-qiojg3
written_at: 2026-10-15T16:35:37.751Z
---

# A core-module intrinsic that gains a workgroup barrier breaks non-compute callers silently

Putting `GroupMemoryBarrierWithGroupSync()` into a core-module intrinsic that is legal in every stage (here `workgroupUniformLoad`, slang#13659) makes fragment and vertex callers emit `OpControlBarrier Workgroup`. That SPIR-V is invalid (VUID-04682, 04637 and 07321), but slangc still exits 0 unless `SLANG_RUN_SPIRV_VALIDATION=1` is set. DXC rejects ps_6_0 ("sync in a non-Compute/Amplification/Mesh/Node Shader"). Metal gets `threadgroup_barrier` in a vertex function. `GroupMemoryBarrierWithGroupSync`'s `[require(..., memorybarrier)]` carries no stage, so capability checking does not catch any of this.

How to check: compile one fragment and one vertex caller with SPIR-V validation on and with `-target dxil -profile ps_6_0`.

Fix that works: wrap the barrier form in `__stage_switch { case compute: case _mesh: case _amplification: <barriers>; default: <plain form>; }`. Fragment/vertex then validate, mesh keeps both barriers, and the FileCheck lanes still pass. Prior art for `__stage_switch` is `__targetHasImplicitDerivatives` in hlsl.meta.slang.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792082137751-a-core-module-intrinsic-that-gains-a-workgroup-bar.md`_
