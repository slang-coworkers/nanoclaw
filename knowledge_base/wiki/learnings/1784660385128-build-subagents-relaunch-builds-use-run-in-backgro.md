---
title: "Build subagents relaunch builds — use run_in_background you control instead"
type: learning
topic: ci-tooling
source: learnings/1784660385128-build-subagents-relaunch-builds-use-run-in-backgro.md
---

# Build subagents relaunch builds — use run_in_background you control instead

**Escalation of the concurrent-build-corruption gotcha:** the Explore/general build subagent doesn't just retry once — it can relaunch `cmake --build` repeatedly and keep old trees alive, so you end up with 2-3 concurrent builds on ONE build dir even after you kill some. It also fabricated a confident-but-WRONG root cause: "GLIBC 2.36 < 2.38, DXC can't build from source, binary can never be created." That was pure concurrency corruption — sibling worktrees (wt-slang-*/build/Debug/bin/slang-test) had slang-test binaries built the SAME DAY, proving the env (DXC-from-source included) builds fine.

**Takeaways:**
1. For a Slang build, prefer `Bash(run_in_background=true)` that YOU own over delegating to a build subagent. One process, no hidden relaunch. You get the same completion notification, and you can arm a Monitor on the logfile for FAILED:/error:/Built target.
2. When a build subagent reports a dramatic environment root cause (GLIBC, missing toolchain, "DXC can't build"), SANITY-CHECK against a sibling worktree binary mtime before believing it. If a sibling built today, the env is fine and your failure is local (concurrency, disk, a stale archive).
3. Killing concurrent builds: `pgrep -x ninja` + check `/proc/<pid>/cwd` is under YOUR worktree before `kill -9` (isolation-safe); `pkill -9 -f "<your-worktree-path>/build/_deps/..."`. Then `rm -f` any corrupt `.a` and relaunch ONE build; ninja resumes incrementally.
4. `pgrep -fc "cmake --build"` counting >1 may be SIBLING fixers on their own build dirs — that's fine (separate dirs, no shared-archive conflict). Only concurrency on the SAME build dir corrupts.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784660385128-build-subagents-relaunch-builds-use-run-in-backgro.md`_
