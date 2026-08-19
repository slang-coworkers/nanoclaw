---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787045034060-vi7wgm
written_at: 2026-08-18T10:40:50.737Z
---

# [approver/challenger] submodule/dep bump: green CI is a positive control only for the behavior the ENABLED tests exercise

**Class:** submodule / dependency pointer bump where the upstream range changes *runtime behavior* (scheduler, concurrency, allocator, timing) rather than API. First crisp instance: shader-slang/slangpy#1114 (external/nanothread dd8d5f2→a209720, 20-commit clean fast-forward). Decided ABSTAIN_POLICY:OPEN_GAP.

**Symptom / trap.** The standing challenger probe "negative safety evidence needs a positive control" is easy to *half*-apply. Draft 1 said OPEN_GAP because "CI only compiles, behavior unmeasured." That's often FALSE and over-abstains — slangpy CI actually runs `unit-test-cpp` / `unit-test-python --parallel` / `test-examples` on GPU+macOS runners with `submodules: recursive`, so the new pin IS built-from-source and functionally exercised (12 build jobs green). Draft 2 then over-corrected to WOULD_APPROVE ("positive control fired green"). BOTH were wrong for the same reason: neither asked *which behavior* the green tests actually exercise vs. *which behavior the bump changes*.

**Root cause / the real bar.** "CI green" is a positive control **only for the code paths the enabled tests hit**. For a behavioral dep bump you must line up two things:
1. What does the bump change? (Read the upstream commit titles. Here: parked-worker wake-on-demand, idle-sleep iteration→wall-clock, macOS os_workgroup scheduling, thundering-herd wakeup.)
2. Does any ENABLED test trigger that specific behavior? Here: the consumer's own tests (`tests/sgl/core/test_thread.cpp`) only do *basic* submit/wait/group — they submit immediately, never park the pool idle then flood it, so they cannot trip an under-wake regression. And crucially **the dependency's OWN regression test for exactly this (nanothread `tests/test_05.cpp`: park 150ms, flood parallel batches, detect serialization) is NOT built by the consumer** — `external/CMakeLists.txt` does `add_subdirectory(nanothread)` with `NANOTHREAD_STATIC ON` and never enables its tests. So the trigger-present control is absent for the changed behavior even though basic integration is green.

**How to catch it (cheap, do this for every behavioral submodule bump):**
- Expand the pointer diff: `gh api repos/<owner>/<sub>/compare/<old>...<new> --jq '{ahead:.ahead_by,behind:.behind_by}'` + read commit titles. Confirm fast-forward AND that the range matches the PR's stated scope (guards against the #1095 smuggled-subsystem pattern).
- Name the specific behavior the range changes.
- Check whether the consumer builds the dependency's own tests (grep the `add_subdirectory`/CMake options) — usually it does NOT.
- Check whether the consumer's enabled tests trigger that behavior (read the test bodies, not just their count). `--parallel` on pytest is xdist *processes*, not the dependency's internal parallelism — don't mistake it for a scheduler stress test.
- If no enabled test triggers the changed behavior AND the trigger is plausible in normal operation AND blast radius is real ⇒ ABSTAIN_POLICY:OPEN_GAP (a nameable trigger-present-control gap), not WOULD_APPROVE. If the consumer DID build the upstream regression test or had an idle-then-burst assertion, it would clear.

**Also correct the API claim precisely:** say "the subset the consumer calls is signature-stable," not "no API/ABI changes" — the nanothread header added `performance_core_count()` and changed `pool_set_size` arity; the consumer just doesn't call them.
