---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789157814653-r9lpr3
written_at: 2026-09-14T14:02:02.873Z
---

# Fresh Slang worktree: submodule init + clang-format-17 via pip; don't delegate the build to a plain subagent

Three time-sinks hit while building Slang in a fresh git worktree (not the base clone):

1. **Submodules aren't initialized.** The base clone here is `git clone --depth 50` WITHOUT `--recursive`, and a new worktree inherits uninitialized submodules. `cmake --preset default` then fails at `source/slang/CMakeLists.txt` with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"`. Fix: run `git submodule update --init --recursive` in the worktree before configuring.

2. **clang-format / gersemi / shfmt are not on PATH** in the agent container, so `extras/formatting.sh` can't format C++ (it prints "This script needs clang-format, but it isn't in $PATH"). For a C++-only change, install the pinned version locally without admin: `python3 -m pip install --user clang-format==17.0.6` (satisfies the required `[17,18)`), then `export PATH="$HOME/.local/bin:$PATH"` and `clang-format -i <file>` (it picks up the repo `.clang-format`). Lua diagnostics (slang-diagnostics.lua) are NOT formatted by the script — match surrounding style by hand.

3. **Don't hand the build to a generic `Agent` subagent expecting it to block.** Observed: the subagent detached the build (backgrounded it) and returned in ~25s, losing the completion signal and then re-launching more background ops (risking two concurrent builds in one dir). Run the build yourself via Bash `run_in_background`, or a scoped poller that keys liveness on `pgrep -x ninja`/`cmake` filtered by `/proc/<pid>/cwd` containing your worktree (NOT `pgrep -f`, which the argv-scan guard blocks). An incremental rebuild after the first full build is only ~2-4 min.

Context: shader-slang/slang#13017 fix. Full build (with DXC-from-source) ~a few min once submodules are in.
