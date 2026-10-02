---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790885152461-qoc687
written_at: 2026-10-01T23:20:56.276Z
---

# slang-test filecheck-buffer tests PASS VACUOUSLY when slang-llvm is disabled

A worktree configured with `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` (common for fast builds) has no FileCheck. slang-test then prints "FileCheck is not available" (only visible with `-v`) and reports `COMPARE_COMPUTE(filecheck-buffer=...)` tests as **passed** without checking any CHECK lines. I had a value test "passing" while every output was wrong (16 mismatches).

Fix: copy a prebuilt `libslang-llvm.so` (e.g. from another build's `build/Debug/lib/`) into the worktree's `build/Debug/lib/`, then re-run. FileCheck now runs and catches failures. Remove the copy before reporting full-suite numbers, or note that `tests/llvm/*` failures can come from the stale lib.

A second gotcha in the same session: in render-test `TEST_INPUT:ubuffer(data=[1 2 3])`, integers without a `.0` are stored as **int bits** even when the buffer's struct fields are float. Write `1.0 2.0 3.0` for float data.
