---
name: project_12397_numthreads_on_called_ordinary_function_spirv
description: "slang#12397 — SPIR-V only: [numthreads] on a called ORDINARY function emits OpExecutionMode for a non-entry-point, crashing slangc (rc=139 3/3 Release, rc=134 Debug). Split from #12392 and NOT assumed to share its fix. RESUME on maintainer triage"
metadata: 
  node_type: memory
  type: project
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# slang#12397 — `[numthreads]` on a called ordinary function → invalid SPIR-V → crash

**Filed 2026-08-06 ~16:14Z by `slang-triager`**, split out of
[[project_12392_entrypoint_calls_entrypoint_constref_segv]] at my request. Verified live by me:
`bug` + `spirv_vulkan` + `reproduced`, `type=Bug`, open, 0 comments, cross-linked on #12392's timeline.
**RESUME TRIGGER:** maintainer triage / assignment.

## The defect

Slang emits a stray `OpExecutionMode %helper LocalSize …` for a `%helper` that is **not** an
`OpEntryPoint` operand ⇒ invalid SPIR-V. Slang's own validator says so
(`SLANG_RUN_SPIRV_VALIDATION=1`: *"OpExecutionMode Entry Point <id> … is not the Entry Point operand of
an OpEntryPoint"*); SPIRV-Tools then aborts in `def_use_manager.cpp:56` during optimization.
Mechanism at source: `emitDecorations` (`slang-emit-spirv.cpp:6058`) walks every decoration and the
`kIROp_NumThreadsDecoration` case (~`:6391`) emits `OpExecutionMode` with **no entry-point check** — I
confirmed the case body has no `entryPoint` reference while surrounding cases do.

**Measured (HEAD Release binary):** rc=139 SIGSEGV 3/3; Debug gives rc=134 (SPIRV-Tools assert) as
corroboration; `-O0` → rc=0 / 812 B; control (drop `[numthreads]`) → rc=0; **spirv-only across all 6
targets.**

## ⛔ Two overstatements the filer corrected before publishing — don't reintroduce them

1. ❌ *"no `[shader(...)]` anywhere"* → ✅ **the helper needs none, but the CALLER does** carry
   `[shader]`. The repro has it on `computeMain`.
2. ❌ *"probably shares a fix with #12392"* → **removed, and rightly.** The helper here is an
   **ordinary function retaining a `NumThreadsDecoration`**, not an orphaned entry point. ⭐⭐ *Assuming
   shared coverage is how a real bug gets silently closed by someone else's patch* — the two defects are
   separable **both** ways: `[shader]` without `[numthreads]` still hits #12392; `[numthreads]` without
   `[shader]` on the callee does not.

## Provenance — it started as a falsified framing

Originally reported (in #12392's notes) as a crash *"inside `GlslangDownstreamCompiler::_invoke`"* with
"two entry points" as the trigger. Both parts were wrong: the crash site is downstream of our own
invalid emission, and during minimization the filer found its **own "untagged control" also aborted**,
which falsified the two-entry-points framing and produced the real trigger.
⭐⭐⭐ **A control that fails is not a ruined experiment — here it relocated the trigger and retitled the
bug.** See [[feedback_the_errors_that_escape_are_in_the_explanatory_layer_not_the_measurements]].
