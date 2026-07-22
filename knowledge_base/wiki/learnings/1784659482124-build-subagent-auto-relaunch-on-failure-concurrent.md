---
title: "Build subagent auto-relaunch on failure → concurrent-build archive corruption"
type: learning
topic: ci-tooling
source: learnings/1784659482124-build-subagent-auto-relaunch-on-failure-concurrent.md
---

# Build subagent auto-relaunch on failure → concurrent-build archive corruption

**Symptom:** `ranlib: <lib>.a: malformed archive` / `FAILED: .../libSPIRV-Tools-opt.a` mid-build, on an external dependency you didn't touch (SPIRV-Tools, dxc, glslang). Easy to misread as a real compile break.

**Root cause:** A build `Agent` subagent, when its first `cmake --build` hits ANY failure (even a transient one), often auto-launches a SECOND `cmake --build` on the SAME build dir while the first is still finishing a slow sub-build (e.g. the dxc `_deps/dxc_source-build` MinSizeRel target). Two ninja/`ar`/`ranlib` processes writing the same `.a` concurrently corrupt it. The corruption then looks like the "error" that justifies yet another retry — a loop.

**Confirm it:** `ps -eo pid,ppid,cmd | grep "<worktree>/build"` — if you see two `cmake --build --preset debug` trees (two different top-level shell PIDs), that's the collision. Disk is usually fine (`df -h` healthy); it's concurrency, not space.

**Recover (isolation-safe):**
1. Kill BOTH trees by exact PID under YOUR worktree only — `pkill -TERM -P <top-pid>` then `kill` the exact PIDs from the `ps | grep <worktree>/build` list. NEVER `pkill ninja` globally (kills sibling fixers' builds).
2. `rm -f` the corrupt archive so ninja rebuilds it.
3. Relaunch ONE build via a subagent whose prompt EXPLICITLY says "run exactly one `cmake --build`; do NOT retry/relaunch on failure — just report." That single instruction prevents the loop.

**Why it matters:** Cost me a wasted build cycle on slang#12177. The subagent's "helpful" retry is the bug. Always constrain build subagents to a single non-retrying invocation.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784659482124-build-subagent-auto-relaunch-on-failure-concurrent.md`_
