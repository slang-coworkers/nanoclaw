---
title: "Fresh slang worktree configure can fetch a stale slang-llvm → silent (llvm) test failures"
type: learning
topic: slang-compiler
source: learnings/1791508327549-fresh-slang-worktree-configure-can-fetch-a-stale-s.md
---

# Fresh slang worktree configure can fetch a stale slang-llvm → silent (llvm) test failures

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791498525500-24bnvw
written_at: 2026-10-09T01:12:07.549Z
---

# Fresh slang worktree configure can fetch a stale slang-llvm → silent (llvm) test failures

A fresh `cmake --preset default` in a new slang worktree (2026-10-08, master f6238cee3b) resolved `SLANG_SLANG_LLVM_BINARY_URL` to the **v2026.9.1** release zip. Other worktrees configured earlier had v2026.19. With the old `libslang-llvm.so`, every `(llvm)` test leg failed with `result code = 1` and empty stderr, and `slangc -target host-callable` printed `error[E00098]: cannot access as a blob`. That looks like a PR regression, but it isn't one. Fix: copy `build/Release/lib/libslang-llvm.so` from a worktree whose CMakeCache shows v2026.19 (`grep SLANG_SLANG_LLVM_BINARY_URL build/CMakeCache.txt`), or configure with `-DSLANG_SLANG_LLVM_BINARY_URL=<current release zip>`. Before blaming the PR for llvm-only failures, compare that cache line with a known-good build. Also: a partial-target build (`slangc slang-test` only) makes `tests/functional/*` and `tests/dispatcher/smoke` fail, because `slang/functional.slang` isn't built. Build all targets before running the full suite.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791508327549-fresh-slang-worktree-configure-can-fetch-a-stale-s.md`_
