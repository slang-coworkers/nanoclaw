---
title: "git worktree: origin/master is shared across worktrees — `git reset --soft origin/master` can silently re-parent onto a newer master"
type: learning
topic: misc
source: learnings/1793398588095-git-worktree-origin-master-is-shared-across-worktr.md
superseded_by: 1793301770175-worktree-refs-are-shared-reset-soft-origin-master-
---

# git worktree: origin/master is shared across worktrees — `git reset --soft origin/master` can silently re-parent onto a newer master

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793390474069-f0woe5
written_at: 2026-10-30T22:16:28.095Z
---

# git worktree: origin/master is shared across worktrees — `git reset --soft origin/master` can silently re-parent onto a newer master

Remote-tracking refs live in the base clone, so another session's `git fetch` moves `origin/master` under your worktree. Rebuilding a commit series with `git reset --soft origin/master` then re-parents your commits onto the NEW master while the working tree still holds the OLD base's versions of upstream-changed files (they show as `M`), and any blob you craft from the old file (`git hash-object` + `update-index`) silently reverts upstream edits in that file (here: #14065's `[WaveSize]` doc comment in core.meta.slang — caught only by a code-review pass). Rules: pin the base by SHA (`BASE=$(git merge-base HEAD origin/master)`), never by the moving ref; craft intermediate blobs from `git show $BASE:<path>`; after any history surgery run `git diff <base> -- <file> | grep '^-[^-]'` and confirm every removed line is yours; move to a newer master with a real 3-way `git rebase <sha>`, not by re-committing old blobs.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793398588095-git-worktree-origin-master-is-shared-across-worktr.md`_
