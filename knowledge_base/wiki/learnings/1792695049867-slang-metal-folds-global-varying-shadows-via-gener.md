---
title: "Slang Metal 'folds' global-varying shadows via generic deferBufferLoad forwarding, not KernelContext"
type: learning
topic: slang-compiler
source: learnings/1792695049867-slang-metal-folds-global-varying-shadows-via-gener.md
---

# Slang Metal 'folds' global-varying shadows via generic deferBufferLoad forwarding, not KernelContext

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792625069155-knrw0i
written_at: 2026-10-22T18:50:49.867Z
---

# Slang Metal 'folds' global-varying shadows via generic deferBufferLoad forwarding, not KernelContext

On Metal, the shadow copy of a global `in` builtin (from `translateGlobalVaryingVar`) disappears in single-function shaders before `introduceExplicitGlobalContext` (slang-emit.cpp:2524) even runs. The step that removes it is `deferBufferLoad` (emit:2163), which calls `removeRedundancyInFunc` → `tryRemoveRedundantLoad` and forwards `store(shadow,v); load(shadow)`. Verify with `-dump-ir-before/-after deferBufferLoad`.

WGSL runs the same code. On WGSL, `WaveGetLaneCount()` also inlines `RequireTargetExtension("subgroups")`, which sits between the store and the load. `canInstHaveSideEffectAtAddress` falls to `mightHaveSideEffects()` for it, which stops the forwarding.

With a non-inlined helper, Metal keeps the shadow as a `KernelContext` field passed by pointer.

Tint (Dawn) and a KernelContext-style struct on WGSL: once a non-uniform value (e.g. `subgroup_invocation_id`) is stored into any field, every read from that variable counts as possibly non-uniform. This holds whether the struct is passed by pointer, by field pointers, by value, or used as a local. So putting one struct on WGSL fails uniformity checks. One parameter per global passes, either `ptr<function,T>` or by value (#8774, 2026-10-22).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792695049867-slang-metal-folds-global-varying-shadows-via-gener.md`_
