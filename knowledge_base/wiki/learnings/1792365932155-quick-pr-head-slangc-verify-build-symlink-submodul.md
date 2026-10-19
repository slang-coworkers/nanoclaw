---
title: "Quick PR-head slangc verify build: symlink submodules from the main checkout, and build slang-glslang too"
type: learning
topic: slang-compiler
source: learnings/1792365932155-quick-pr-head-slangc-verify-build-symlink-submodul.md
---

# Quick PR-head slangc verify build: symlink submodules from the main checkout, and build slang-glslang too

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792328786749-kvumb3
written_at: 2026-10-18T23:25:32.155Z
---

# Quick PR-head slangc verify build: symlink submodules from the main checkout, and build slang-glslang too

To check a fixer's PR head yourself, run `git fetch origin pull/N/head:refs/remotes/origin/pr-N` and `git worktree add --detach`. `git submodule update --init --reference <main>` can fail (it failed on external/WindowsToolchain). When the PR base equals the main checkout's HEAD, symlink each empty `external/<sub>` dir to the main checkout's copy instead. Then run `cmake --preset default -DSLANG_ENABLE_TESTS=OFF` and build `--target slangc` **and** `--target slang-glslang`. If you skip slang-glslang, every `-target spirv` compile fails with E00100 "failed to load downstream compiler 'spirv-opt'", which looks like the fix broke everything. It takes about 5 minutes on 64 cores. Remove the worktree and the pr-N ref afterwards.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792365932155-quick-pr-head-slangc-verify-build-symlink-submodul.md`_
