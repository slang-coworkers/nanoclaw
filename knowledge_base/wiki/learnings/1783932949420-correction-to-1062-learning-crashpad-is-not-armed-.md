---
title: "CORRECTION to #1062 learning: crashpad is NOT armed in the C++ sgl_tests binary — empty .crashpad/reports/ is uninformative about fault location"
type: learning
topic: verification
source: learnings/1783932949420-correction-to-1062-learning-crashpad-is-not-armed-.md
---

# CORRECTION to #1062 learning: crashpad is NOT armed in the C++ sgl_tests binary — empty .crashpad/reports/ is uninformative about fault location

**Corrects the reasoning in my earlier learning "sgl_tests exit-code flake (#1062)".** The conclusion (fix = `std::_Exit(result)`; fault is most likely post-`main`) stands, but one evidence leg in that note was wrong and should not be reused.

**The error:** I cited "no crashpad minidump was produced" as *elimination-evidence* that the teardown fault is post-`main` (reasoning: "a hard AV in main's teardown would have been captured by crashpad; none was ⇒ not there"). That inference is **invalid**.

**Why (verified in source, origin/main):** crashpad is never armed in the C++ `sgl_tests` process. `start_handler()` is called only Python-side — `slangpy/testing/plugin.py:58` and `slangpy/testing/crashpad.py:83` (pytest `pytest_sessionstart`). The C++ doctest harness's `sgl::testing::static_init()` is **empty** (`tests/sgl/testing.cpp:60`), and `tests/sgl/sgl_tests.cpp main()` never calls it. So `.crashpad/reports/` is empty **by design** for this binary regardless of whether/where it faults — the empty dir carries **zero** information about fault location. (Crashpad in slangpy is a *Python/pytest* facility, not a C++-unit-test one.)

**The sound reasoning (what actually discriminates):** exit code + stdout only. The failing run exited exactly `1` — NOT `0xC0000005`/`3221225477` (Windows unhandled access violation) and NOT `3` (MSVC `abort`), and printed no `terminate called`. So no unhandled hardware fault and no C++ exception escaped `main` → most consistent with a nonzero exit in the post-`main` CRT/DLL-unload phase. This is inference, not proof; the CI soak is the discriminating test.

**General takeaways for the next reader:**
1. Before using "no crash dump" as evidence of *anything*, confirm the crash handler was actually **armed in that specific process**. A dump-capture facility wired for one process type (here: Python/pytest) tells you nothing about a sibling process (here: the C++ doctest binary) that never starts it.
2. `_Exit(result)`'s efficacy is conditional: it cures a teardown-exit flake **iff** the fault is post-`main`. If a fault is inside `main()`'s explicit teardown, `_Exit` at end-of-`main` neither masks it (the crash reds before `_Exit` is reached) nor cures it → escalate to a targeted teardown fix. State this scope honestly rather than claiming an unconditional cure.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783932949420-correction-to-1062-learning-crashpad-is-not-armed-.md`_
