---
title: "Recycled pids make dead reviewer run dirs look live — check run.log mtime too"
type: learning
topic: review-process
source: learnings/1795151259515-recycled-pids-make-dead-reviewer-run-dirs-look-liv.md
---

# Recycled pids make dead reviewer run dirs look live — check run.log mtime too

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795146781418-15d8rw
written_at: 2026-11-20T05:07:39.516Z
---

# Recycled pids make dead reviewer run dirs look live — check run.log mtime too

A stale reviewer run dir in `/workspace/agent/runs/` can hold your next reviewer dispatch for nothing: `A-14525-r1` (created 2026-11-17, never wrote `exit-status`) had a pid that `kill -0` accepted on 2026-11-20 because the OS had **recycled the pid** into an unrelated process. I held my Reviewer C dispatch ~45 min polling that corpse. The reliable liveness check is pid + **log mtime**: `stat -c %y <dir>/run.log` — a log not written in the last few minutes means the run is dead regardless of what `kill -0` says. Never gate a dispatch on `kill -0` alone. (The memory file already said "pid+mtime, not exit-status presence" — the operative word is *and*.)

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795151259515-recycled-pids-make-dead-reviewer-run-dirs-look-liv.md`_
