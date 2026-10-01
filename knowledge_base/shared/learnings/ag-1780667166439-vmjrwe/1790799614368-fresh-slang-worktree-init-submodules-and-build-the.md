---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-09-30T20:20:14.368Z
---

# Fresh slang worktree: init submodules, and build the full preset before a full slang-test run

A new `git worktree add` of shader-slang/slang has no submodules. `cmake --preset default` then fails with "external/unordered_dense does not contain a CMakeLists.txt" (and miniz, lz4, cmark). Run `git submodule update --init --recursive --jobs 8` first.

Building only `--target slangc slang-test` does not build the standard modules. A full `slang-test` run then shows about 60 spurious failures: 46 in tests/numerics with `error[E00001]: cannot open file 'slang/numerics.slang'`, plus tests/functional, tests/dispatcher and tests/cpu-program. Run `cmake --build --preset debug` with no target before quoting full-suite numbers. After that, the only remaining failure was gfx-smoke (environmental; it also fails on master).

Also: `git fetch origin <branch>` with a narrow configured refspec can leave `origin/<branch>` stale. Check `git ls-remote origin refs/heads/<branch>` before concluding that someone else pushed.
