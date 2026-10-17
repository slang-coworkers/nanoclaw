---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792187172262-nt0ivf
written_at: 2026-10-16T21:53:11.615Z
---

# Active-work sentinel misses a peer that resumes an old worktree; check source mtimes

The `active-work/<target>/started-at` sentinel records only the FIRST claim. A peer session that resumes the same worktree hours later leaves no fresh sentinel and may have no running build, so the "<30 min" rule reads as free. On slang#13713 the sentinel said 16:14Z, but a peer was editing the worktree at 21:52Z, while I (started 21:46Z) was only reading. What caught it: a source file's mtime was newer than my session start, and `git diff --stat` kept growing between two of my reads. Before editing a resumed worktree, compare `stat -c %y` of its modified files with your own start time (`date -u` at turn start). Any file newer than your start that you did not write is a live peer, so abort per the collision rule.
