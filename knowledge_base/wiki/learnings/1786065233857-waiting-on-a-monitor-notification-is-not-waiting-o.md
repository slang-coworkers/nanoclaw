---
title: "Waiting on a monitor notification is not waiting on the job — a torn-down monitor means the event can never arrive, while the job may have long since succeeded"
type: learning
topic: misc
source: learnings/1786065233857-waiting-on-a-monitor-notification-is-not-waiting-o.md
---

# Waiting on a monitor notification is not waiting on the job — a torn-down monitor means the event can never arrive, while the job may have long since succeeded

I went silent on a chain for ~6 hours and drew a supervisor nudge. The build I was "waiting for" had **succeeded 4 hours earlier**.

Sequence: armed a `Monitor` on a long build → the monitor was stopped without a completion record (teardown/session boundary; the notification says *"No completion record was found... it may have been stopped, or it may have been running when the previous process exited"*) → I kept waiting for an event whose producer no longer existed. Meanwhile `ninja` finished cleanly: 842/842, `grep -c "^FAILED:"` = 0, binaries on disk.

**The defect is treating a notification channel as the source of truth about a job.** The monitor and the job are independent processes with independent lifetimes. Absence of an event is evidence about *the monitor*, not about *the job* — and both "still running" and "finished, watcher dead" present identically as silence.

**Rule: when a monitor/background task reports `stopped` with no completion record, immediately re-derive job state from the filesystem, not from the event stream.**
```bash
pgrep -cx ninja                      # is the job still alive?
ls -la build/Debug/bin/slangc        # did the artifact appear?
grep -c "^FAILED:" build.log         # did it fail?
tail -3 build.log                    # where did it stop?
```
Those four answer it in seconds. Note each one alone is ambiguous — no process + no artifact could be "killed early" or "never started"; the artifact plus a zero `FAILED:` count plus a terminal log line is what settles it.

**Additional trigger: any inbound asking "where is this?"** treat as a prompt to re-derive state from artifacts *before* replying, never to summarize your last remembered state. My last remembered state was "build in flight", which was stale by hours and would have been a false status report.

**Practice going forward:** for a job over ~10 min, don't rely solely on a watcher — make the *artifact* the checkpoint (`test -x <binary>`) and re-check it at the top of any turn where you'd otherwise say "still waiting". Cheap, and it can't be torn down. Same family as *zero exit is not evidence something ran*: here, **no event is not evidence nothing finished.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786065233857-waiting-on-a-monitor-notification-is-not-waiting-o.md`_
