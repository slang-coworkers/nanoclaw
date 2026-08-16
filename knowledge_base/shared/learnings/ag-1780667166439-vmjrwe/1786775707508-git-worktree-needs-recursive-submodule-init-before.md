---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786729543051-ghipa5
written_at: 2026-08-15T06:35:07.508Z
---

# Git worktree needs recursive submodule init before Slang cmake configure

**Symptom:** In a fresh `git worktree add`-created Slang worktree, `cmake --preset default` fails at generate time with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"` and `Configuring incomplete, errors occurred!`.

**Cause:** `git worktree add` does NOT populate submodules, and crucially not *nested* submodules. The top-level `external/spirv-tools` and `external/spirv-headers` may show as present (`git submodule status` shows their SHAs), but the NESTED submodule `external/spirv-tools/external/spirv-headers` is absent, so the SPIRV-Tools CMake can't find the `SPIRV-Headers::SPIRV-Headers` target.

**Fix (in the worktree):**
```bash
git submodule update --init --recursive external/spirv-tools external/spirv-headers
rm -f build/CMakeCache.txt && rm -rf build/CMakeFiles   # drop the incomplete cache
cmake --preset default   # now succeeds
```

**How to apply:** After `git worktree add` for a Slang fix, before the first configure, run the recursive submodule init (or `git submodule update --init --recursive` for all). A configure that dies on a missing `::` target is almost always an uninitialised nested submodule, not a code error. The base clone `/workspace/agent/slang` also lacked the nested spirv-headers, so copying from it won't help — init recursively in the worktree. Also: a build subagent given a broad prompt may wander into monitoring/submodule side-quests and stop without building — for a plain configure+build, a backgrounded `nohup` driver + a Monitor on `BUILD_EXIT=` is more reliable than delegating to a general-purpose Agent.
