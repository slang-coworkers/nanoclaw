---
name: project_slangpy_1098_nanothread_optix_nesting_invariant
description: "slangpy#1098 nanothread adapter: ABSTAIN_POLICY/OPEN_GAP twice. Submodule bump 46a66b47 REMOVES the CUDA guard while OptiX nesting is unchanged, violating slang-rhi's own 'must return false' invariant — an UPSTREAM defect, not a slangpy one. My 'contract moved' claim refuted by hash."
metadata:
  node_type: memory
  type: project
  originSessionId: 90646629-86e1-48ba-83cc-a4d851bc960c
---

# slangpy#1098 — nanothread `ITaskPool` adapter · the real finding is UPSTREAM in slang-rhi

**State 08-10:** OPEN, non-draft, MERGEABLE. Two approver revisions, both
`ABSTAIN_POLICY`/`OPEN_GAP`, 6/6 clauses, severity raised at R2. Head `15f68792` → `f51ef4fa`.
Ledger dark both times (see [[feedback_record_decision_ok_proves_emission_not_persistence]]).

## MINE-VERIFIED, all at pinned refs (`contents?ref=`, hashes not eyeballs)

**My claim "the bump moves the cited `ITaskPool` contract" — REFUTED.** `include/slang-rhi.h` is
**byte-identical** across `f8460cca` → `46a66b47`: 133960 bytes, sha256 `cf752aa420381279` both.
The approver caught this and was right. ⚠️**My sha differs from the one it reported
(`c9b9730be4c3b9b8`) — different digest scope (it hashed the extracted `ITaskPool` block, I hashed
the whole header); both conclusions agree, so the disagreement is cosmetic. Noted because two
different hashes for "the same" object is exactly the shape of a wrong-file read.**

**The approver's claim — CONFIRMED, and I extended it to an invariant violation:**

| leg | evidence at `46a66b47` |
|---|---|
| guard removed | `src/cuda/cuda-device.h:24-28`: was `return pipeline->getType() != PipelineType::RayTracing` + comment *"OptiX ray-tracing pipeline creation submits nested work to the global task pool. Run it on the caller thread…"* + a TODO proposing to **flatten** that work → now `SLANG_UNUSED(pipeline); return true;` |
| invariant it must honour | `src/device.h:436-442`: *"Backends opt individual pipelines into creation on the global task pool. **Pipelines that perform nested work on that pool must return false.**"* (base returns `false`) |
| **was the nesting flattened first?** | **NO.** `src/cuda/optix-api-impl.cpp` is **byte-identical** across the bump (`cmp` clean). `executeOptixTasks` (`:562`) still `createTaskGroup` → `submitTask` → task fn **submits sub-tasks into the same group** (`:599-613`) → **`taskPool->waitAndReleaseTaskGroup(group)` at `:634`**, reached from a task callback. Called with `globalTaskPool()` at `:758`. |
| routing onto the pool | `src/pipeline-resolver.cpp:394-418`: `canCreatePipelineOnTaskPool` → `workerRequests` → `TaskBatch(globalTaskPool())` … `batch.wait()` |

⇒ ⭐⭐⭐**The TODO's precondition ("flatten this work") was never done, and the guard was removed
anyway. `return true` for CUDA RT is a direct violation of the invariant stated 2 files away** —
independent of slangpy and of the nanothread adapter. **The adapter merely makes it *this* PR's
problem; the defect is upstream slang-rhi `#826`.** That reframing is mine and is the escalation-worthy
part: filing it against #1098 would put it on the wrong repo.

⭐**Materiality bound the approver did not state:** `pipeline-resolver.cpp:401` gates the pooled path
on **`workerRequests.size() > 1`** — a single RT pipeline still runs on the caller thread (`:420-425`).
So it needs **≥2 CUDA RT pipelines in one resolve**, plus (from slangpy) `pipeline_compilation_mode=parallel`
(non-default) and CUDA/OptiX hardware. Bounds likelihood; the invariant violation is unconditional.

## Why the abstain is right rather than a BLOCK
Upstream's new `parallel-pipeline-creation-cuda-ray-tracing` test calls `initTaskPool(1)`, **replacing**
the global pool ⇒ it never exercises `NanothreadTaskPool`. It corroborates the hazard is real (its own
comment: *"Two pipeline tasks saturate the single worker plus the waiting caller"*) without closing it.
Devin's 🔴 (shutdown abort at `thread.cpp:139`) did **not** survive the approver's check —
`sgl.cpp:60` releases RHI resources before `thread::static_shutdown()` at `:65` — correctly downgraded
to 🟡 and held as *"not sustained"*, not *"disproven"* (source read only).

**Closure ask (for a human):** run slang-rhi's task-pool conformance cases against `NanothreadTaskPool`,
or add a slangpy test that waits on a group from inside a callback on a 1-worker pool.
