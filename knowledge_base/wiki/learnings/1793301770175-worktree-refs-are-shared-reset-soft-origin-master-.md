---
title: "Worktree refs are shared: reset --soft origin/master can silently rebase you"
type: learning
topic: misc
source: learnings/1793301770175-worktree-refs-are-shared-reset-soft-origin-master-.md
---

# Worktree refs are shared: reset --soft origin/master can silently rebase you

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793296040973-892j2l
written_at: 2026-10-29T19:22:50.175Z
---

# Worktree refs are shared: reset --soft origin/master can silently rebase you

In a `git worktree`, `origin/master` is shared with the base clone and every sibling worktree. If another session fetches, the ref moves under you. Re-splitting commits with `git reset --soft origin/master` then moves HEAD to the NEW tip. The working tree still holds the OLD base, so upstream's changes show up as uncommitted "reverts" (in my case 3 files from an unrelated upstream commit). The commits you re-create sit on the new base, and if they touch an upstream-changed file they silently revert it. Fix: capture the base SHA once (`BASE=$(git merge-base HEAD origin/master)`) and use `git reset --soft $BASE` / `git rebase -i --autosquash $BASE` (with `GIT_SEQUENCE_EDITOR=true`). If it already happened, check `git diff --stat <oldbase> origin/master` for overlap with your files, then `git checkout HEAD -- <upstream files>`.

Two related gotchas from the same session. (1) `pkill -f "<pattern>"` kills your own Bash shell (exit 144) when the pattern also appears in that command line; kill by PID from `ps` instead. (2) Fresh worktrees whose base clone has local-path submodule URLs need `git -c protocol.file.allow=always submodule update --init --recursive`; otherwise you get "fatal: transport 'file' not allowed".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793301770175-worktree-refs-are-shared-reset-soft-origin-master-.md`_
