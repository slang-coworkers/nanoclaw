---
title: "slang#12051 DescriptorHandle reloads every use — root cause is shouldDuplicateInstAtUseSite + non-hoistable cast op"
type: learning
topic: slang-compiler
source: learnings/1783705209384-slang-12051-descriptorhandle-reloads-every-use-roo.md
---

# slang#12051 DescriptorHandle reloads every use — root cause is shouldDuplicateInstAtUseSite + non-hoistable cast op

**Issue:** shader-slang/slang#12051 (feature-request) — `DescriptorHandle<T>` descriptors are re-loaded on *every* use, so a handle sampled repeatedly in a loop reloads each iteration. Reporter (maxime-modulopi, external) got **2.5% faster** by pinning the load once via inline-SPIR-V `spirv_asm { result:$$This = OpCopyObject $this }`. Not a bug — intended codegen. Verified at HEAD `4676e878e`.

**Root cause (two independent mechanisms, both confirmed by direct Read):**
1. `shouldDuplicateInstAtUseSite()` at `source/slang/slang-ir-util.cpp:2634-2642` **hard-codes** `case kIROp_CastDescriptorHandleToResource:` → `return true` ("These casts potentially produce non-storable types, so we will always duplicate them at use sites"). So the cast is cloned at every use even when one def dominates all uses. (`kIROp_CastDynamicResource` shares this.)
2. The descriptor cast/load ops are **NOT** `hoistable` in `source/slang/slang-ir-insts.lua:2710-2732` — `CastDescriptorHandleToResource` (`:2731`), `SPIRVLoadDescriptorFromHeap` (`:1064`), `LoadResource/SamplerDescriptorFromHeap` (`:1057-1062`). Contrast `MakeStorageTypeLoweringConfig = { hoistable = true }` two lines above at `:2726`. `hoistable=true` is what drives the IRBuilder's global value-numbering dedup (`_findOrEmitHoistableInst`, `slang-ir.cpp:2699`; `slang-ir-deduplicate.cpp`). Without it, repeated identical loads never collapse.

**Lowering path:** `operator*` → `getDescriptorFromHandle` → intrinsic `__castDescriptorHandleToResource` (`kIROp_CastDescriptorHandleToResource`), all `[ForceInline]` (`hlsl.meta.slang:27512-27517`, `:27577-27578`, default body `:27588-27589`). Under `spvDescriptorHeapEXT` the form is `__spirvLoadDescriptorFromHeap` (`kIROp_SPIRVLoadDescriptorFromHeap`, `:27562-27564`) instead — same triage conclusion.

**CSE/LICM caveat (avoid the wrong fix):** `removeRedundancy`/`removeRedundancyInFunc` (`slang-ir-redundancy-removal.cpp:111,318`) and LICM `tryHoistInstToOuterMostLoop` (`:14`) DO run in the emit pipeline (`slang-emit.cpp:1290,1622,1842,2407`, on both sides of resource legalize `:1794` + heap lowering `:1845`) — so ordering is not the problem. BUT LICM's `hoistLoopInvariantInsts` flag (`slang-ir-ssa-simplification.h:22`) is enabled **only** in autodiff (`slang-ir-autodiff-fwd.cpp:2432`), not the general pipeline. And **marking the op `hoistable` is the WRONG lever** to get per-loop reuse — `hoistable` means module-global GVN dedup / hoist-to-outermost-scope, not per-function loop LICM. The right levers: relax `shouldDuplicateInstAtUseSite` for dominating loop-invariant casts on targets that can hold the value as SSA, and/or enable `hoistLoopInvariantInsts` for these ops.

**Why the OpCopyObject workaround wins (and what it proves):** it materializes the loaded descriptor once as a plain SSA copy the duplication rule doesn't recognize as the cast op, so uses reference the single copy. This proves the "non-storable types" duplication is *conservative for the SSA-value case* — the descriptor CAN be reused as an SSA value on SPIR-V (it's the pointer/variable form that's non-storable). That's the opening for an opt-in "pin/load-once" builtin (recommended Approach A).

**Triage classification:** feature-request/enhancement, low, P3, Component IR (+SPIR-V emit, core-module). Type set to `Feature`. No `reproduced` label (by-design behavior; perf delta needs a GPU). External reporter but issue is complete with a working workaround → post verdict, no reproducer request. **NOT a duplicate of #11568** (that's `ResourceDescriptorHeap[i]` *input syntax*, maintainer-owned via csyonghe's `UntypedResourceHandle` design) — adjacent but distinct (input-spelling vs load-reuse). DescriptorHandle is the strategically maintainer-owned bindless path → any A/B fix wants csyonghe/jkwak design sign-off before merge.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783705209384-slang-12051-descriptorhandle-reloads-every-use-roo.md`_
