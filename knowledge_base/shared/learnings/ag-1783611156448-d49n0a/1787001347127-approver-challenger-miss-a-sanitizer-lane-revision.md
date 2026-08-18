---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786998787240-iokice
written_at: 2026-08-17T21:15:47.127Z
---

# [approver/challenger-miss] A sanitizer-lane revision can fix the flagged race yet stay red — halt_on_error=0 turns "stop at first race" into "enumerate all pre-existing races"

**Context:** slangpy#1112 R1 (synchronize). R0 flagged one TSan data race (`test_lmdb_cache.cpp:42 in rng()`). The author's R1 fixed exactly that race (refactored the shared mutable `static` `rng()` into a per-instance `RNG` struct; also moved `file_system_watcher.cpp`'s `m_last_event` inside its mutex). Decision both revisions: ABSTAIN_POLICY(OPEN_GAP).

**Symptom / trap:** It's tempting to reason "the flagged race is fixed ⇒ the lane is now green ⇒ upgrade toward approve." Wrong on two counts here.

**Root cause:** The same R1 commit ALSO changed the TSan options from `halt_on_error=1` to `halt_on_error=0:exitcode=66` (in both `sanitizers.yml` matrix and `setup-sanitizer-env.py`). `halt_on_error=1` aborts at the FIRST race — so R0's run only ever showed one. `halt_on_error=0` keeps running and enumerates EVERY race, then `exitcode=66` makes the process exit nonzero if any were found. So R1's run surfaced a large set of **pre-existing** races in untouched code (`src/sgl/core/thread.cpp` NanothreadTaskPool + `test_thread.cpp`) plus a TSan-internal `CHECK failed: tsan_interceptors_posix.cpp:2068`. The lane the PR adds still fails — now for a broader reason than R0.

**How to catch it:** When a revision touches sanitizer/error-handling *options* alongside a fix, re-read the option semantics — a fix to the flagged item does not imply the lane passes. Always re-pull the *actual* CI/dispatch log for the new head (`gh api --allow-escape-sequences .../jobs/{id}/logs`) and grep for `SUMMARY:`/`data race`/`CHECK failed`; do NOT infer green from "the specific finding was addressed." Count the distinct race sites, and attribute each to touched vs untouched code (races in untouched code = surfaced-not-introduced, but the lane still doesn't pass → still an OPEN_GAP-class "land-red-vs-fix-first" human call).

**Fix / rule:** For a new sanitizer/analysis CI lane, "did the flagged issue get fixed?" and "does the lane pass?" are independent questions — and an option change (halt_on_error, exitcode, fail-fast) can widen what the lane reports between revisions. Re-derive the lane's pass/fail from its own fresh log every revision. Related: [[workflow_dispatch lane exercised but red-on-arrival]], and the Core-Memory "read the artifact, not the framing".
