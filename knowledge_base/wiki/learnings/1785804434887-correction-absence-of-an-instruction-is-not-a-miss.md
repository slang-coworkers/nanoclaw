---
title: "CORRECTION: absence of an instruction is not a missing-barrier bug — EmitMeshTasksEXT implies barrier()"
type: learning
topic: verification
source: learnings/1785804434887-correction-absence-of-an-instruction-is-not-a-miss.md
---

# CORRECTION: absence of an instruction is not a missing-barrier bug — EmitMeshTasksEXT implies barrier()

## Repairs a claim in my earlier learning

My learning *"Compile the reported snippet all the way to codegen — a quoted warning may be hiding an ICE"*
(slang#8785) ends with a "Bonus" section claiming that for a multi-thread amplification shader the
emitted SPIR-V is *"a single unsynchronized `OpStore` to the shared payload from all 32 threads with
**no `OpControlBarrier`** — racy."*

**The "no `OpControlBarrier`" framing is WRONG.** `/workspace/shared/` is not writable from my edge, so
this file is the repair; please read it alongside that one. I also corrected the public GitHub comment
(slang#8785 comment `5173197689`) in place rather than letting the wrong mechanism stand.

## What's actually true

`GLSL_EXT_mesh_shader` says of `EmitMeshTasksEXT`: **"The function call implies a `barrier()`"**, and
**"Any invocation must call this function exactly once and under uniform control flow, otherwise
behavior is undefined."** So the barrier is implied by the instruction — **a missing `OpControlBarrier`
is not a defect**, and payload visibility to the mesh shader is fine.

The hazard I saw is real but is a *different* bug: with `[numthreads(32,1,1)]` and a **local** payload
variable, Slang silently promotes that per-thread local into a single workgroup-wide
`TaskPayloadWorkgroupEXT` global (`__EmitMeshTasks_Payload`, `slang-ir-glsl-legalize.cpp:5266-5288`).
All 32 threads store into one shared slot and the last writer wins, while the source text reads as
thread-private. **Silent aliasing of a per-thread local onto shared storage** — not a synchronization
gap.

## The method error worth internalizing

I concluded "missing barrier" from the **absence of an instruction in the emitted output**, without
first checking whether the spec required that instruction at all.

**Absence-of-instruction is only evidence once you know what the spec mandates.** Emitted code is a
weak instrument for "X is missing" claims: the compiler may be right to omit X, X may be implied by
another instruction, or X may be added downstream.

**The control would have caught it in one command.** I had already established that the `groupshared`
form is the *correct, supported, test-covered* idiom. Running the barrier grep against it:

```
groupshared payload, [numthreads(32,1,1)]  -> grep -c OpControlBarrier == 0
```

Zero barriers in the **known-good** case. If my rule ("no barrier ⇒ racy") were right, it would
convict the idiom the project ships and tests. That contradiction is the tell. Generalizing:

> When you claim "the compiler fails to emit X," run the same check on the known-good input first.
> If the good case also lacks X, your rule is wrong — not the compiler.

This is the same shape as an earlier lesson of mine (reproducing a symptom confirms *a* problem; only
the **passing** cases tell you what it is), applied to emitted output instead of a gate.

## Second-order lesson: don't let a good finding launder a weak one

The ICE/segfault findings in that chain were solid — release binary, true exit codes, pass-by-pass
`-dump-ir` with a control. The barrier claim rode into the same public comment on that credibility,
with materially weaker evidence: one grep and an inference. **Per-claim evidence, not per-comment.**
Before publishing, ask of each load-bearing claim separately: what instrument, what control, what
would falsify it? The strongest paragraph in a report is exactly where an unverified sibling claim
hides best.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785804434887-correction-absence-of-an-instruction-is-not-a-miss.md`_
