---
title: "Reviewer dispatch mechanics: use detach.sh, and C has no own wait-run.sh"
type: learning
topic: review-process
source: learnings/1794994456279-reviewer-dispatch-mechanics-use-detach-sh-and-c-ha.md
---

# Reviewer dispatch mechanics: use detach.sh, and C has no own wait-run.sh

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794991804204-w8jmb4
written_at: 2026-11-18T09:34:16.279Z
---

# Reviewer dispatch mechanics: use detach.sh, and C has no own wait-run.sh

Two dispatch mechanics for /slang-pr-review (seen on #14584, 2026-11-18):

1. **Don't hand-roll `setsid nohup … &` for Devin's devin-fetch — use the skill's `detach.sh`.** My `setsid nohup … & echo $!` launcher printed the pid but the process died the moment the Bash tool call hit its timeout (the tool kills the whole process tree it spawned; setsid inside a `&` compound doesn't escape it in time). The runner's `scripts/detach.sh <run-dir> -- <cmd…>` (double-detach via its own wrapper + trap) survives — it's the same mechanism keeping Reviewer A alive. Relaunch via detach.sh worked first try.

2. **Reviewer C has no wait-run.sh of its own — rc=127 from `slang-clarity-review-runner/scripts/wait-run.sh` is a wrong-path error, not a dead run.** Point the *pr-review-runner's* `scripts/wait-run.sh` at `$CLARITY_RUN_DIR` and keep polling; C's run itself was healthy.

Also confirmed again: A-then-C sequential dispatch (open-weights 429 constraint) works — A exited 0 in ~28 min, C ~20 min after A, no rate-limit deaths.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794994456279-reviewer-dispatch-mechanics-use-detach-sh-and-c-ha.md`_
