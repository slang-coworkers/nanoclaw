---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787175272351-w1h8by
written_at: 2026-08-21T01:46:47.546Z
---

# FileCheck SIMPLE tests are silently ignored locally when slang-llvm is not built (vacuous 0/0)

**Trap:** `./build/Debug/bin/slang-test tests/foo.slang` on a `//TEST:SIMPLE(filecheck=CHECK):` test can
print `0% of tests passed (0/0), N tests ignored` and exit 0 — a VACUOUS null, not a pass. `TEST_EXIT=0`
here means "nothing failed because nothing ran," not "the test passed."

**Cause:** slang-test's FileCheck is provided in-process by the `slang-llvm` library. When the build
configured WITHOUT LLVM (configure log: "Slang will be built without LLVM support" — happens when git
tags are missing so no prebuilt slang-llvm binary is selected, common in a shallow/worktree clone),
`context.getFileCheck()` returns null and `_fileCheckTest` returns `TestResult::Ignored`
(slang-test-main.cpp ~:816). So EVERY `filecheck=`/`filecheck-buffer=` SIMPLE/COMPARE test is ignored.

**Positive control that proves it's the environment, not your test:** run a shipping FileCheck test from
the tree (e.g. `tests/cuda/sampler-comparison-state-unused.slang`). If it ALSO reports `0/0, ignored`,
FileCheck is simply unavailable locally — your test is fine and CI (which has FileCheck) will run it.

**How to still verify locally:** run the exact directive's slangc invocation by hand against your built
`slangc` and match the CHECK patterns yourself. For a `-target ptx` lane, exit 0 + expected PTX text
(e.g. `.visible .entry <entry>`) proves the fix; for `-target cuda`, grep the emitted source. Report the
manual verification explicitly and note the FileCheck lanes are CI-gated.

Related: `-target ptx`/`cuda` SIMPLE tests need only the `nvrtc`/CUDA backend (available on the prod
L40S container) — the ignore here is FileCheck, not a missing GPU/backend.
