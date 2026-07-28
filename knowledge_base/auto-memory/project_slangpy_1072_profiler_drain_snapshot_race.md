---
name: slangpy-1072-profiler-drain-snapshot-race
description: "slangpy#1072 profiler drain() snapshot-order race finalizes empty frames; P1 CI flake fix in flight"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1f98e769-cee1-48cb-a375-95117b083d43
---

**slangpy#1072** — Profiler can finalize a global frame before consuming attached cross-thread zones. Author **jkwak-work** (maintainer). Opened 2026-07-24.

- **Classification (triager, verified first-hand):** bug in newly-landed profiler PR #1063 / high / SGL C++ `src/sgl/utils/profiler.cpp` / **P1**. NOT upstream-Slang.
- **Root cause:** `ProfilerImpl::drain()` snapshots per-thread zone queues BEFORE snapshotting `sealed_frame_events` (profiler.cpp ~739-765). A zone published+sealed in the unlocked window between the two snapshots gets its frame finalized empty → nondeterministic frame stats.
- **Two CI repros at commit `5a1b34b63a78904aeb092bc6475744edc500a83c`:** (1) macOS ARM64 Debug, cross-thread test `test_profiler.cpp:371-373`, expected `[1,1]` got `[0,1]`; (2) Windows Debug py3.10, `device close settles pending frame statistics` `test_profiler.cpp:596`, empty GPU frame. **Thread-count-INDEPENDENT** — collector runs async; `pending_gpu_count` only bumped when CPU zone event consumed (profiler.cpp:932-933). One fix covers both.
- **Recommended fix (maintainer's proposal, triager-endorsed):** reorder the two snapshots in `drain()` — sealed-frame snapshot first, then queue acquire-loads, keeping consume-zones-before-frames. Memory-ordering proof holds. Keep existing cross-thread test. Alternatives (broaden locking / defer finalize) rejected — worse blast radius.
- **Chain state:** RESOLVED 07-24. Fix implemented (Approach A — reorder the two snapshots in `drain()`: sealed-frame vector under `sealed_frame_mutex` first, then per-thread queue acquire-load of `write_index`; consume order + GPU block unchanged; +14/−5). Covers BOTH repros. **Draft PR #1073** (`Fixes #1072`, branch dev/slangpy-fixer/1072, base main@5a1b34b). Tests: both guards pass (test_profiler.cpp:331, :596); profiler suite 17/17; no new sgl_tests reds. codex PLAN/CODE/OUTPUT approved; slangpy-reviewer peer-approved (confirmatory, status unchanged). Issue carries refreshed 5-bullet (comment 5066273737, now "peer-approved"); auto-closes on merge.
- **Next human action:** review + promote draft #1073 to ready, then merge. Merge OPERATOR-gated. Not upstream-Slang. (As of 07-27: #1073 promoted out of draft, CI all-green, but REVIEW_REQUIRED with ZERO reviews — blocked purely on human approval.)

## Follow-up chain — #1077 (re-enable disabled tests) — HELD 07-27
**slangpy#1077** "Re-enable profiler tests disabled for collector race" (jkwak-work, opened 07-27). Asks to un-skip the two guard tests once #1073 merges. Triaged → **BLOCKED/HOLD, no fix dispatched.**
- **Doubly-gated (subtlety issue text omits):** the `doctest::skip()` markers #1077 removes are ADDED by PR **#1076** ("Temporarily disable intermittent profiler tests"), which is ALSO still open/unmerged. On `main` today both tests (`test_profiler.cpp:331`, `:596`) exist WITHOUT skip. So re-enabling needs BOTH #1076 AND #1073 merged. If #1073 lands but #1076 is closed-unmerged → #1077 is MOOT (nothing to un-skip).
- **Resumption trigger:** #1073 merged AND #1076 merged (skips present). Then ~5-min mechanical revert of #1076's skip hunks + build + profiler suite + `pre-commit run --all-files` → slangpy-fixer.
- **Fixer caveats (from shared learnings):** (1) the two guards are TIMING-DEPENDENT — a green run does NOT validate #1073's fix (correctness rests on a memory-ordering argument, no new test added). (2) building the C++ profiler suite needs the git-lfs font workaround (`data/` is an LFS submodule; container has pointer stubs only).
- Triager posted 5-bullet holding note: https://github.com/shader-slang/slangpy/issues/1077#issuecomment-5092676498. Chain HELD (not closed). Shared learning recorded on the doubly-gated trap.
