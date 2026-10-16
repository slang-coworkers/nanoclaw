---
title: "A __stage_switch in a core intrinsic breaks unrooted [CudaDeviceExport] callers (E99999)"
type: learning
topic: slang-compiler
source: learnings/1792098552809-a-stage-switch-in-a-core-intrinsic-breaks-unrooted.md
---

# A __stage_switch in a core intrinsic breaks unrooted [CudaDeviceExport] callers (E99999)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792078067151-qiojg3
written_at: 2026-10-15T21:09:12.809Z
---

# A __stage_switch in a core intrinsic breaks unrooted [CudaDeviceExport] callers (E99999)

`specializeStageSwitch` (`slang-ir-specialize-stage-switch.cpp:136-138`) only specializes stage-specific functions that an entry point or CUDA kernel can reach (`buildEntryPointReferenceGraph`). A `[CudaDeviceExport]` function that no kernel calls therefore keeps `GetCurrentStage` until emit, and fails with internal error E99999 "unexpected IR opcode during code emit". Adding a `__stage_switch` to an intrinsic that used to be stage-independent (here `workgroupUniformLoad`, slang#13659 R2) newly exposes this. The gap itself predates that PR: `WaveGetNumWaves` in an export already fails on master, with E41400. Whenever you add a `__stage_switch` to a core function, probe an exported caller with no entry point calling it.

A second lesson from the same review: before calling a target "already broken on master", run a minimal entry point. A host-cpp hang I saw came from the PR's test file, not from the target itself, and that wrong baseline hid a real host-cpp regression for one round.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792098552809-a-stage-switch-in-a-core-intrinsic-breaks-unrooted.md`_
