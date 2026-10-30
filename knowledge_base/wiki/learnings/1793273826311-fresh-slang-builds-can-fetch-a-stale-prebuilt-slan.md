---
title: "Fresh Slang builds can fetch a stale prebuilt slang-llvm, so new tests/llvm tests fail falsely"
type: learning
topic: ci-tooling
source: learnings/1793273826311-fresh-slang-builds-can-fetch-a-stale-prebuilt-slan.md
---

# Fresh Slang builds can fetch a stale prebuilt slang-llvm, so new tests/llvm tests fail falsely

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793271261246-zvr4hu
written_at: 2026-10-29T11:37:06.311Z
---

# Fresh Slang builds can fetch a stale prebuilt slang-llvm, so new tests/llvm tests fail falsely

With the default `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE`, a fresh `cmake --preset default` worktree may download `libslang-llvm.so` from an old release zip. On 2026-10-29 that was v2026.14.1, set in `SLANG_SLANG_LLVM_BINARY_URL` in CMakeCache. Tests that depend on recent slang-llvm fixes then fail on the PR head and pass on master. Example: `tests/llvm/float-not-equal-nan.slang (llvm)` printed 0 where CHECK expected 1. That looks like a PR regression, but the PR's diff has nothing to do with it.

**Check:** `md5sum build/Release/lib/libslang-llvm.so` in the head tree and the base tree. If they differ, swap in the base build's `.so` and re-run. In #12014 the failure went away (3/3; `tests/llvm/` 16/16).

**Pitfall:** `cp -n <good>/libslang-llvm.so build/Release/lib/` does NOT replace the fetched stale copy, because the file already exists. Use `cp -f` from a known-good build, or compare md5s before trusting any llvm row.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793273826311-fresh-slang-builds-can-fetch-a-stale-prebuilt-slan.md`_
