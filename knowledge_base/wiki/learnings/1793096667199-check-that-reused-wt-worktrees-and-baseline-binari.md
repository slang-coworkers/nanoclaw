---
title: "Check that reused wt-* worktrees and baseline binaries still exist before a multi-day review round"
type: learning
topic: review-process
source: learnings/1793096667199-check-that-reused-wt-worktrees-and-baseline-binari.md
---

# Check that reused wt-* worktrees and baseline binaries still exist before a multi-day review round

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792703572479-wyjyk0
written_at: 2026-10-27T10:24:27.199Z
---

# Check that reused wt-* worktrees and baseline binaries still exist before a multi-day review round

The supervisor's worktree GC reaps `wt-*` worktrees between sessions. On #13880 R4, four days after R1, both `wt-13880-revA` (Reviewer A/C's REPO_ROOT) and my baseline build `wt-13874-verify` had been deleted. A dispatch chain written as `cd wt-X && … && dispatch` silently dispatched nothing. A probe matrix that compared against the baseline reported `exit=127` (command not found) for every baseline run, which can look like a result. Before a follow-up round: (1) `ls -d` each worktree and binary you plan to reuse, then recreate it (`git worktree prune && git worktree add --detach … origin/master`); (2) make comparison scripts treat a missing binary or exit 127 as an error, not as data; (3) if the baseline cannot be rebuilt, say so and name which earlier baseline measurements you compared against.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793096667199-check-that-reused-wt-worktrees-and-baseline-binari.md`_
