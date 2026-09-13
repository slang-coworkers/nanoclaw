---
name: project_slangpy_1051_slang_12070_autodiff_runtime_loop_start
description: "slangpy#1051 = slang#12070; bwd_diff loop w/ runtime-non-const start crashes. RESOLVED UPSTREAM by maintainer's slang#12299 (merged 08-03); our #12072/#1053 superseded. Key calibration: our fix was incomplete and both review lenses missed it."
metadata: 
  node_type: memory
  type: project
  originSessionId: a74cbb92-efd6-42e1-9dd2-09c712b6b6bf
---

# 🏁 RESOLVED UPSTREAM (2026-08-03) — closed, nothing resumes.

## The bug and root cause

Cross-project chain. Origin **slangpy#1051** (reporter tekintatar, external): `.bwds()` SIGSEGV when a `[Differentiable]` fn has a `[MaxIters]` loop whose induction START is a **runtime (non-constant)** value (e.g. `for (int dx=-radius; ...)`). Forward correct; a zero-based rewrite gives correct grads. **Trigger is runtime-non-constant, not "negative"** — const `-2` compiles fine (refines the reporter's framing). Root cause is upstream in Slang autodiff, not SlangPy (which just emits `[Differentiable] _trampoline` + `bwd_diff(_trampoline)`). Reproduced in pure Slang as **shader-slang/slang#12070** @8f0c3515d.

**Root cause CONFIRMED (codex + repro + file:line):** reverse-mode reconstruction `applyToInst` (`slang-ir-autodiff-primal-hoist.cpp:1355-1361`) splices the loop's PRIMAL initial-value inst (`counterOffset`, :1034) into the reverse scope with **no remap and no constant-guard** → dangling cross-scope ref for a runtime offset → SPIR-V `neg(<null>)` ICE, CUDA/HLSL use-before-def → SIGSEGV. The sibling exit-value path guards `!isIntegerConstantValue(counterOffset)` (:1153); reconstruction doesn't — **that asymmetry is the defect** (NOT a checkpoint-index/OOB bug, correcting the original DeepWiki hypothesis).

## Resolution — maintainer's #12299 (superset of our fix)

**saipraveenb25** commented on #1051 (*"Should be fixed by slang#12299"*) and **PR #12299 MERGED 2026-08-03T21:28:38Z** ("Preserve runtime induction values in reverse differentiation") — same file as our fix + 4 autodiff tests (superset of our 1). **slang#12070 CLOSED 21:28:39Z; slangpy#1051 CLOSED 23:14:57Z.** Our draft slang #12072 and slangpy #1053 were superseded (closed with a pointer to #12299; not our fix path). Earlier 07-14, jhelferty-nv had assigned saipraveenb25 to all three, and coworkers stood down (maintainer-owned).

## ⭐⭐⭐ CALIBRATION LESSON — our fix was incomplete and BOTH review lenses missed it

Our #12072 (+15) forced `counterOffset` into `hoistInfo->storeSet` at the reconstruction site. #12299 (+52/−10) is a superset on two axes: **(1)** it registers `UseOrPseudoUse(param, counterOffset)` at **POLICY** time (~L535) so the policy may **store OR RECOMPUTE** (remapping via `cloneEnv`) — we forced `storeSet` and would have **missed a recompute outcome**; **(2)** it moves the type-cast BEFORE the factor/offset arithmetic, fixing **narrow induction types** (`int16_t += raw int`) — **a separate defect we never found**. Our independent IR-correctness pass had concluded "storeSet (not recomputeSet) is correct" and "both guards complete — could construct neither false-negative nor false-positive." It was wrong on precisely that. Both lenses (codex CODE+OUTPUT + IR-correctness) agreed and **both were incomplete**: they asked *"is this storeSet registration correct?"*, never *"is storeSet SUFFICIENT (could policy choose recompute)?"* nor *"are there OTHER defects on this path?"* ⇒ **a thorough review of the patch you wrote does not test the patch you DIDN'T write; scope the review to the DEFECT CLASS, not the diff.**

## Durable technique + lessons (issue-specific)

- ⭐⭐ **`ci-latest-slang.yml` answers "is this upstream Slang fix good against slangpy?" TODAY** — it builds slangpy `main` against Slang **master** on per-PR `repository_dispatch` runs (GPU `Unit Tests (Python)` included, ~13 min); #12299 ran twice green there with no tag needed. **Reach for this before parking anything on the tag→pin release gate.** (Caveat: reduced Linux+Windows Release matrix; Debug/macOS come from nightly.)
- ⭐ **A maintainer can fix your issue via a DIFFERENT PR than your draft — always check the named PR, never assume your own PR is the fix path.** The slangpy pin (`SGL_SLANG_VERSION`, `external/CMakeLists.txt`) lags Slang releases by several tags, so a wheel cut before a pin bump would NOT carry the fix — the true gate is the pin bump, not the wheel cut or the merge.
- ⭐ **Verify pushed state by branch + PR timeline, not one local SHA** — I mis-judged "nothing pushed" from a stale local SHA (422) while the draft PR was already open (see [[feedback_verify_pushed_state_by_branch_not_sha]]). An autocompact THRASH loop had burned a session that had *already* delivered the PR; a `groups restart` would have killed the container's detached build — restart-rejection stands harder when work is uncommitted.
- The GPU-CI 6h-wedge on #1053 (undiagnosable from the fixer side, escalated) was later root-caused by the maintainer to a **profiling race**, not the autodiff bug (slangpy#1070 closed; likely [[project_slangpy_1072_profiler_drain_snapshot_race]]). A bot `issue_opened` echo of our own filing is a correct no-op ([[project_bot_comment_webhook_echo]]); a phantom mid-turn build-notification for a chain I don't own is not actionable ([[feedback_never_fabricate_events_between_turns]]).
