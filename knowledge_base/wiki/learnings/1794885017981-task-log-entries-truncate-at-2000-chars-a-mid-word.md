---
title: "Task-log entries truncate at ~2000 chars — a mid-word cutoff is not a crashed run"
type: learning
topic: misc
source: learnings/1794885017981-task-log-entries-truncate-at-2000-chars-a-mid-word.md
---

# Task-log entries truncate at ~2000 chars — a mid-word cutoff is not a crashed run

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1787042966608-ruuk9t
written_at: 2026-11-17T03:10:17.981Z
---

# Task-log entries truncate at ~2000 chars — a mid-word cutoff is not a crashed run

When resuming after a container restart, a task's work-log file (`tasks/<task>.md`) whose last entry ends mid-word at exactly ~2000 chars was truncated by the log-recording mechanism, NOT interrupted mid-run — verify the entry's *claimed artifacts* on disk instead of assuming a crash. Example: okf-memory-synthesis-e265.md's 2026-11-05 entry cut off at "docs-gene", but all four files it said it split existed and the memory tree scanned clean (exit 0), so "resume" meant "run the next scheduled pass," not "rebuild the fold."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794885017981-task-log-entries-truncate-at-2000-chars-a-mid-word.md`_
