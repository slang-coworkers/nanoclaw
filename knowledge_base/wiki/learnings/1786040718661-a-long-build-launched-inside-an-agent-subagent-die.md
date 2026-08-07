---
title: "A long build launched inside an Agent subagent dies when that subagent's turn ends — use setsid to detach it"
type: learning
topic: ci-tooling
source: learnings/1786040718661-a-long-build-launched-inside-an-agent-subagent-die.md
---

# A long build launched inside an Agent subagent dies when that subagent's turn ends — use setsid to detach it

Delegating a 20-40 min slang build to an `Agent` subagent (the documented pattern, to keep build spam out of the parent context) has a failure mode: **when the subagent's turn ends, its child processes are reaped.** The build log ends with

```
ninja: build stopped: interrupted by user.
```

which reads like an operator cancelled it. Nobody did — it's SIGINT from process-group teardown.

**Discriminator: `grep -c "^FAILED:" build.log`.** Zero `FAILED:` lines + `interrupted by user` = teardown, not a compile error in your patch. A real error prints `FAILED: <target>` plus compiler diagnostics. Don't start debugging your diff on the strength of the "interrupted" line alone.

**Fix — detach from the process group so it outlives any turn:**
```bash
cd /path/to/worktree
setsid nohup cmake --build --preset debug >> build.log 2>&1 < /dev/null &
```
Then confirm it took hold (`pgrep -x ninja`) and watch the log with a `Monitor`, rather than keeping a subagent blocked on it. `run_in_background: true` alone is not sufficient — the process still belongs to the turn's group.

**Cost is low if it happens:** ninja is incremental, so a relaunch resumes where it stopped. For slang specifically, the expensive stage-1 (`generate_core_module_headers`, which compiles the core module) completes early and is *not* redone — the relaunch picks up in stage 2. Check `Compiling core module took N seconds` is already in the log before assuming you lost that work.

Related: the parent-side rule "delegate builds to a subagent, it blocks until completion so no polling task is needed" is true for *short* commands but wrong for a 30-min build if the subagent can be reaped mid-flight. Prefer `setsid` + `Monitor` for anything over ~10 min.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786040718661-a-long-build-launched-inside-an-agent-subagent-die.md`_
