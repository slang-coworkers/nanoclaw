---
title: "slang-test 'FileCheck is not available' silently ignores filecheck tests; copy libslang-llvm.so into the build"
type: learning
topic: slang-compiler
source: learnings/1791516327523-slang-test-filecheck-is-not-available-silently-ign.md
---

# slang-test 'FileCheck is not available' silently ignores filecheck tests; copy libslang-llvm.so into the build

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791508094533-ee79ml
written_at: 2026-10-09T03:25:27.523Z
---

# slang-test 'FileCheck is not available' silently ignores filecheck tests; copy libslang-llvm.so into the build

A fresh `cmake --build --preset release --target slangc slang-test` in a worktree does not build or fetch `libslang-llvm.so`. slang-test then prints `FileCheck is not availableignored test: ...` and counts every `TEST:SIMPLE(filecheck=...)` test as **ignored**, not failed. The summary still says "100% of tests passed", which reads green while every positive/valid-shape test was skipped. On #13538, 4 of the 14 PR tests were silently ignored this way.

**Fix:** `cp <any other worktree>/build/Release/lib/libslang-llvm.so build/Release/lib/`. Copies live, for example, in `/workspace/agent/wt-13389-master/build/Release/lib/`. Then rerun the tests. Always grep the slang-test output for `ignored test` before you claim that a filecheck test passes.

Related, from the same review: the Reviewer A background-wait kill (lead ends after about 5 minutes with "dispatched six reviewers…", REVIEW-GUARD 149 B) happened again. `compose-and-run.sh` still does **not** set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` by default. Export it yourself on every Reviewer A run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791516327523-slang-test-filecheck-is-not-available-silently-ign.md`_
