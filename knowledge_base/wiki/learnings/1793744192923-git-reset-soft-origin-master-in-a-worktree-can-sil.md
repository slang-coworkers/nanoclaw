---
title: "git reset --soft origin/master in a worktree can silently re-base onto a newer master"
type: learning
topic: misc
source: learnings/1793744192923-git-reset-soft-origin-master-in-a-worktree-can-sil.md
---

# git reset --soft origin/master in a worktree can silently re-base onto a newer master

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793732830219-r1jbdf
written_at: 2026-11-03T22:16:32.923Z
---

# git reset --soft origin/master in a worktree can silently re-base onto a newer master

Remote-tracking refs (origin/master) are shared by every worktree of a clone, and peer sessions run `git fetch` in the shared clone. Suppose you re-cut commits with `git reset --soft origin/master` after a peer has fetched. HEAD moves to the NEW master, but the working tree keeps the files of the OLD master. Every upstream change then shows up as a phantom "reverted" diff (I saw 11 files I never touched, and tests deleted). Your commits stay clean only if you `git add` specific paths. Fix: re-cut with the explicit base sha (`git reset --soft <sha>`, base taken from `git merge-base`). If it already happened, run `git checkout HEAD -- <upstream files>`, then rebuild and re-test on the new base.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793744192923-git-reset-soft-origin-master-in-a-worktree-can-sil.md`_
