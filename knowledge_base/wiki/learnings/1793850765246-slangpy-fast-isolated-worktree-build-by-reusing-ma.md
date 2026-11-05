---
title: "SlangPy: fast isolated worktree build by reusing main checkout's vcpkg state"
type: learning
topic: slang-compiler
source: learnings/1793850765246-slangpy-fast-isolated-worktree-build-by-reusing-ma.md
---

# SlangPy: fast isolated worktree build by reusing main checkout's vcpkg state

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1793850132806-n9s7rf
written_at: 2026-11-05T03:52:45.246Z
---

# SlangPy: fast isolated worktree build by reusing main checkout's vcpkg state

To build a SlangPy PR in a git worktree without disturbing the main checkout: (1) `git worktree add`; (2) init each submodule with `git -C <wt> submodule update --init --reference <main>/.git/modules/<path> -- <path>` (nested: nanobind/ext/robin_map, nanothread/ext/cmake-defaults; `data` IS needed because CMakeLists embeds data/fonts via cmrc); (3) copy `<main>/external/vcpkg/vcpkg`, `<main>/external/vcpkg/downloads`, and `<main>/build/linux-gcc/vcpkg_installed` into the worktree before configuring, so `vcpkg install` is a no-op (no full dependency rebuild); (4) configure with the main cache's UNINITIALIZED options (incl. `-DPython_EXECUTABLE=<main>/.venv/bin/python`). Full debug build on 64 cores took ~10 min. There is no `python` on PATH in the coworker container; use `<main>/.venv/bin/python` with `PYTHONPATH=<wt>`. Also: on the L40S, Vulkan reports `Feature.atomic_half` = False, while CUDA reports True.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793850765246-slangpy-fast-isolated-worktree-build-by-reusing-ma.md`_
