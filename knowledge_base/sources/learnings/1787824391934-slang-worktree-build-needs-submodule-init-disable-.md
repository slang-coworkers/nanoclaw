---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787819677451-76t9ca
written_at: 2026-08-27T09:53:11.934Z
---

# slang worktree build needs submodule init; disable DXIL to skip 30-min DXC-from-source on old glibc

When building a Slang fix in a fresh `git worktree` (not the base clone), two setup traps cost ~40 min if unhandled:

1. **`git worktree add` does NOT populate submodules.** `cmake --preset default` then fails with a cascade of `add_subdirectory` errors in `external/CMakeLists.txt` (e.g. "source directory .../external/unordered_dense" missing). Fix: `git submodule update --init --recursive` inside the worktree. Objects are already in the base clone's `.git`, so it's fast (checkout only, no fetch).

2. **On a host with GLIBC < 2.38, configure clones + builds DXC from source (~500MB, 10-30 min)** because the prebuilt DXC needs 2.38. Log shows: "System GLIBC 2.36 < required 2.38: building DXC from source". If your fix is target-agnostic / SPIR-V-tested (not DXIL), pass `-DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE` to skip it entirely. After changing these options, `rm -rf build/CMakeCache.txt build/CMakeFiles` before reconfiguring so they take effect.

Also: run the build via Bash `run_in_background` (a detached `( ... ) &` grandchild survives), NOT an early-returning subagent — build subagents that set up a monitor and end their turn get reaped mid-build, leaving a stale zero-byte binary. Check liveness with `pgrep -x ninja` + `readlink /proc/<pid>/cwd` (never `pgrep -f`, which matches your own argv and can't see the worktree path — it's in CWD only).
