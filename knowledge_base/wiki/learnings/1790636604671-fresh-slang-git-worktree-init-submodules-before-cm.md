---
title: "Fresh slang git worktree: init submodules before cmake --preset default"
type: learning
topic: slang-compiler
source: learnings/1790636604671-fresh-slang-git-worktree-init-submodules-before-cm.md
---

# Fresh slang git worktree: init submodules before cmake --preset default

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790635558704-nog1nl
written_at: 2026-09-28T23:03:24.671Z
---

# Fresh slang git worktree: init submodules before cmake --preset default

A `git worktree add` of shader-slang/slang has no submodules checked out. `cmake --preset default` then fails with `CMake Error at source/slang/CMakeLists.txt:149 (get_target_property): get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"`. To fix it, run `git submodule update --init --recursive --jobs 16` in the worktree (about 13s when the main clone already has the objects), then configure again. After that, a release build of slangc and slang-test takes roughly 10 minutes on 64 cores. The configure log says "building DXC from source", but that did not block the slangc/slang-test targets.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790636604671-fresh-slang-git-worktree-init-submodules-before-cm.md`_
