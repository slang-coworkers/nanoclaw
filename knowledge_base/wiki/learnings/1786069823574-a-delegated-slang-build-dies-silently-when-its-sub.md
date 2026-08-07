---
title: "A delegated Slang build dies silently when its subagent is reaped — ninja takes SIGINT and writes no exit code"
type: learning
topic: slang-compiler
source: learnings/1786069823574-a-delegated-slang-build-dies-silently-when-its-sub.md
---

# A delegated Slang build dies silently when its subagent is reaped — ninja takes SIGINT and writes no exit code

**Rule:** Do not hand a 15-25 min Slang build to an `Agent` subagent and expect it to survive. When the
subagent is reaped or detaches early, its child `ninja` receives **SIGINT** and the log ends with
`ninja: build stopped: interrupted by user`. Run the build as a background job tied to **your own
session** (`Bash` with `run_in_background: true`, or `nohup bash -c '…' &`) writing its exit code to a
dedicated marker file.

⛔ **This contradicts `/slang-implement` Step 5 and `/slang-fix-issue` Step 6**, which instruct *"always
delegate it to an `Agent` subagent… the subagent blocks until the build completes, so no polling task is
needed."* That premise is exactly what fails. Honour the *intent* (keep build output out of your
context) by backgrounding rather than delegating.

**Why it is silent — the dangerous part.** The interruption is not a build failure:
- The exit-code marker is **never written** (the wrapper died before `echo $? > …`), so a waiter keyed
  on that file hangs forever and a "did it fail?" check finds nothing.
- The log's last lines are ordinary `[221/1453] Building CXX object …` progress, then
  `interrupted by user`. No `FAILED:`, no `error:`, no OOM, no disk message.
- A monitor grepping only failure signatures **stays silent**, and silence is indistinguishable from
  "still compiling."

⇒ **A build monitor must watch THREE outcomes:** exit-file appears (done), failure signature (broken),
and **process gone while no exit file exists** (killed).

```bash
if ! pgrep -f "ninja -f build-Debug" >/dev/null 2>&1 && [ ! -f build/build-exit.txt ]; then
    echo "BUILD_DIED: no ninja and no exit file — last $(grep -aoE '^\[[0-9]+/[0-9]+\]' build/build.log | tail -1)"
    exit 1
fi
```

**Diagnose before re-running,** or you spend an hour "fixing" nothing: `pgrep -a -f "ninja|cmake"`
(gone while poller shells linger ⇒ killed), `free -g` + `dmesg | tail` (no OOM ⇒ not resources),
`df -h`. Also check `uptime`: these hosts hit **load 120-190 on 8 cores** from concurrent sibling
builds, and a loaded Slang build takes **~115 min, not 25** — a 25-30 min monitor window expiring is
not evidence of a stall.

**Recovery is cheap:** ninja resumes at the last completed object (mine picked up at 221/1453, nothing
lost). Skip the already-done `git submodule update --init --recursive` and `cmake --preset default`;
append to the same log (`>>`) so pre-interruption history survives. Before restarting, kill any racing
build — `pkill -9 -f "cmake --build --preset debug"` **and** `pkill -9 -f "ninja -f build-Debug"`, then
confirm no `.ninja_lock`; two builds in one dir SIGINT each other.

Observed three times across separate fixes (2026-07-16, 2026-08-05, 2026-08-07).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786069823574-a-delegated-slang-build-dies-silently-when-its-sub.md`_
