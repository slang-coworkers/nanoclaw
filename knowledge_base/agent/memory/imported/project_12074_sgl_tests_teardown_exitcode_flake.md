---
name: project_12074_sgl_tests_teardown_exitcode_flake
description: "SGL sgl_tests exits nonzero AFTER all tests pass (post-main teardown crash) → reddens slang PRs via the cross-repo SlangPy Tests check. Tracking issue slangpy#1062. RESTING/PARKED: PR #1118 (arm Crashpad, diagnostics-only) maintainer-promoted; root-cause fix deferred pending crash data (~20d cadence)."
metadata:
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

## Signature

A PR's `SlangPy Tests` check goes red because SGL `sgl_tests` **returns nonzero
AFTER all tests pass** (e.g. 178 doctest cases + 14598 assertions PASSED, then
`sgl_tests` exits 1 → `RuntimeError` at slangpy `tools/ci.py`). A pure
**teardown/exit-code flake**: results are green, the exit code doesn't reflect
them. Reddens **arbitrary slang PRs** through the cross-repo SlangPy-tests
trigger, unrelated to PR content. **Not bot-rerunnable** — the CI gateway token
is scoped `slang/*` only, so it stays red until fixed at source. Genuine
recurrence: two occurrences ~20d apart (slangpy runs `27965567210` 2026-06-22 and
`29232873855` on #12074, 07-13), identical mode.

## Root cause (triager-verified in source; SGL is a nested/differently-pinned dep, not readable via a quick `gh` call)

`sgl_tests.cpp` `main()` captures the green doctest `result`, then a **post-`main`**
static-dtor / DLL-unload phase faults during GPU-device destruction / rhi-resource
release on self-hosted nvrgfx Windows, exiting nonzero though `result==0`. The
explicit teardown in `main()` runs fine; only the *implicit* post-`main` phase
crashes, so no minidump is written today — `sgl_tests` **never arms Crashpad**
(handler is Python-side only, `plugin.py`; guard is `SGL_HAS_CRASHPAD`, not the
raw `SGL_ENABLE_CRASHPAD` CMake option — and `config.h` reaches `sgl_tests.cpp`
only transitively, so `#if SGL_HAS_CRASHPAD` silently becomes `#if 0` without an
explicit `#include "sgl/core/config.h"`).

## Resolution / current state — OPEN but PARKED

- **[slangpy#1062](https://github.com/shader-slang/slangpy/issues/1062)** tracks it. Auto-close is a **manual GitHub link, not a `Closes #1062` keyword**, so it stays OPEN even post-merge until closed by hand.
- **[PR #1118](https://github.com/shader-slang/slangpy/pull/1118)** maintainer-promoted (ready-for-review). **Diagnostics-only**: arms Crashpad in `sgl_tests` `main()` (guarded `SGL_HAS_CRASHPAD`, adds the explicit `config.h` include) **and** fixes the cross-repo composite-action dump upload (whole `.crashpad/` DB + `include-hidden-files`, since `upload-artifact` skips dot-dir contents). It **captures the next teardown fault; it does not fix the flake.**
- **Root-cause fix DEFERRED by the maintainer** pending crash data from the armed build — recurrence cadence ~20d, so data is slow and the chain goes quiet after #1118 lands.
- **#1064 CLOSED (superseded).** Its fix was `return result;` → `std::fflush(nullptr); std::_Exit(result);`. @skallweitNV rejected `_Exit` ("not a good idea to hide potential issues during shutdown"); jhelferty-nv converged on the same *diagnose-don't-mask* direction, which is why #1118 (instrument) replaced it.
- **Deferred maintainer follow-up:** the identical 2-line `.crashpad/` upload fix must also be applied to `.github/workflows/ci.yml` for **in-repo** lanes — the bot App token lacks `workflows` permission, so a maintainer applies it (durably noted in the #1118 body). The cross-repo "SlangPy Tests" lane (the actual #1062 target) *is* covered by #1118.

## Durable lessons (the chain's real yield — general lessons live in their own concepts)

- **`last_active` is a WAKE signal, not a SUCCESS signal.** A successful turn leaves an OUTBOUND row; a woken-but-failing container advances `last_active` yet emits nothing. Check the outbound row, never `last_active`. → [[feedback_last_active_tracks_inbound_not_agent_work.md]]
- **A capability-negative ("the agent can't process turns") has no failure signature** — an idle session and a broken one both emit zero outbound. I published "group-scoped agent down / check credentials" to the operator and had to retract it when a **sibling session's** 01:27 output proved the agent healthy. Find a positive control before escalating a negative. → [[feedback_capability_negative_needs_a_search_not_two_guesses.md]]
- **A wedged single session** (here `sess-1783930927484-yfwb5z`: created 07-13, idle ~5wk, then bounced "unknown provider error" on every wake after the 08-18 handoff) is bound to its canonical thread. Delivery was verified 4×, group restart didn't target it, a session-pinned wake landed but the turn still wouldn't run. **Remedy = re-dispatch on a FRESH sub-thread** (`…/fixer-fresh`), which mints a clean session — not more re-drives to the wedged one.
- **Don't bank a root-cause acceptance on a downstream verification step until you've confirmed the step CAN run.** #1064 was accepted partly because "the fixer will stackwalk the crashpad minidump" — but there was no minidump (Crashpad was never armed C++-side). The gate never fired; #1118 exists to actually build it.
- A maintainer `CHANGES_REQUESTED` with a real body is a **design-direction pushback, not an edit list** → [[feedback_changes_requested_read_body]]; hold the chain open for the direction, don't close the open proposal → [[feedback_dont_close_open_proposals]].
