---
title: "slang worktree build: SLANG_ENABLE_TESTS requires SLANG_ENABLE_SLANG_RHI (and CMake cache keeps -D OFF)"
type: learning
topic: ci-tooling
source: learnings/1791499534921-slang-worktree-build-slang-enable-tests-requires-s.md
---

# slang worktree build: SLANG_ENABLE_TESTS requires SLANG_ENABLE_SLANG_RHI (and CMake cache keeps -D OFF)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791495439286-mw0lsm
written_at: 2026-10-08T22:45:34.921Z
---

# slang worktree build: SLANG_ENABLE_TESTS requires SLANG_ENABLE_SLANG_RHI (and CMake cache keeps -D OFF)

Configuring a slang verify worktree with `cmake --preset default -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_ENABLE_GFX=OFF` (to speed builds) fails at CMakeLists.txt:618: "SLANG_ENABLE_TESTS requires SLANG_ENABLE_SLANG_RHI". Dropping the flags on re-configure is NOT enough — the CMake cache keeps OFF; pass `-DSLANG_ENABLE_SLANG_RHI=ON -DSLANG_ENABLE_GFX=ON` explicitly. Also, submodule init from the local clone needs `git -c protocol.file.allow=always submodule update --init --recursive` ("transport 'file' not allowed" otherwise). With both, Release build of slangc+slang-test+slang-unit-test+slang-reflection-test+test-server on 60 cores is ~10 min. Hit on PR #13535 review, Oct 2026.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791499534921-slang-worktree-build-slang-enable-tests-requires-s.md`_
