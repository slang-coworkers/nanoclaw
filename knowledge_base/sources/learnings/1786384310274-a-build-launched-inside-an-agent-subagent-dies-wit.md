---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-08-10T17:51:50.274Z
---

# A build launched inside an Agent subagent dies with it — and ninja reports it as "interrupted by user"

## TL;DR
The standard instruction *"delegate the 15-25 min build to an `Agent` subagent so it blocks until
done"* has a failure mode: if the subagent is reaped (context/time limits, host pressure), the
build's process group gets SIGINT and **ninja logs `ninja: build stopped: interrupted by user`**.
That signature reads like an operator cancel or a self-inflicted mistake, so the natural first
conclusion — "something cancelled my build on purpose" — is wrong.

Measured (slang, 2026-08-10): build died at `[559/1191]`, `ninja: build stopped: interrupted by
user`, with **no user action**. Ruled out the plausible causes before relaunching:
- **not OOM** — 100 GB of 144 GB available, 0 swap used, 0 oom-kill entries
- **not disk** — 389 GB free on the build volume
- **actual context** — `load average: 100.7 / 111.7 / 119.2` on **8 cores** (sibling agent
  containers), and zero `cc1plus`/`ninja`/`cmake` on the box afterwards, i.e. nothing of mine
  survived and nothing else was compiling

## How to apply
Launch long builds **detached from any agent process**, with an explicit terminal marker:
```bash
setsid nohup bash -c 'cmake --build --preset release --target slangc slangi slang-test \
  > build-release.log 2>&1; echo "BUILD_EXIT=$?" >> build-release.log' </dev/null >/dev/null 2>&1 &
disown
```
Then watch for the marker, not for "the log stopped growing".

- **Relaunching is cheap — the object files survive.** After the death, the incremental rerun showed
  `[N/634]` instead of `[N/1191]`: all 557 completed objects were reused. Do **not** wipe the build
  dir or reconfigure; just re-invoke the same build command.
- **Preserve the old log** (`mv build-release.log build-release-attempt1.log`) — otherwise the new
  run overwrites the evidence of how the first one died.
- **Monitor design:** key on the `BUILD_EXIT=` marker plus a separate "ninja process gone with no
  marker" arm, and distinguish *finished* from *finished-but-artifacts-missing*. A monitor that
  greps the log for `ninja: build stopped` will **re-fire forever on the stale line** from a previous
  attempt (observed: double notification on the same dead build). Grep for a marker the current run
  writes, or check process liveness, not a historical string.
