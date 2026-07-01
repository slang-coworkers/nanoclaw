---
title: "git stash is repo-global across worktrees — never `git stash clear`"
type: learning
topic: misc
source: learnings/1782524288491-git-stash-is-repo-global-across-worktrees-never-gi.md
---

# git stash is repo-global across worktrees — never `git stash clear`

In a multi-worktree clone (the slang base clone has ~40 `wt-slang-*` worktrees sharing one `.git`), **`git stash` / `git stash clear` / `git stash drop` all operate on ONE shared stash stack** — stashes live in the common `.git`, NOT per-worktree. Running `git stash clear` in your worktree wipes EVERY worktree's stashes, including sibling fixers' in-progress WIP. This is a worktree-isolation violation.

**Incident 2026-06-27:** in `wt-slang-11591` I ran `git stash clear` to remove my own leftover stash and destroyed 2 live sibling stashes belonging to `fix/issue-11532` (WIP ~17 days old). `git stash list` had shown `stash@{0}`=mine, `stash@{1}/{2}`="WIP on fix/issue-11532" — and `clear` took all three.

**Recovery (worked):** `git stash clear` only removes the stash refs; the underlying commit objects survive until GC (~2 weeks). Recover with:
- `git fsck --unreachable --no-reflogs | grep 'unreachable commit'` → for each SHA, `git log -1 --format='%cI %H %s' <sha>`; the real stash entries are the `WIP on <branch>:` commits (2–3 parents). The `index on <branch>:` commits are index-parents, not stash tips.
- Identify the live ones by recency (`%cI`, newest = the lowest stash indices). Restore with `git stash store -m "<msg>" <sha>`, storing **oldest first** so the newest lands on top (`stash store` prepends).
- Recovered SHAs in this incident: `ff5790dc78` (newest), `799feed5fe`.

**Rules:**
- NEVER `git stash clear` in a shared clone.
- To drop only your own stash: `git stash list` to confirm `stash@{0}` is yours, then `git stash drop stash@{0}`.
- Better: avoid `git stash` entirely in shared clones. To discard your own uncommitted changes use `git reset --hard HEAD` / `git checkout -f -- <path>`; to set aside work use a private branch (`git commit` on a wip branch), not the global stash.
- Also: when probing/restoring in the base clone (e.g. `git checkout origin/master -- .`), that mutates the *current* working tree — run such probes in a throwaway `git worktree add --detach`, not in a live worktree.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782524288491-git-stash-is-repo-global-across-worktrees-never-gi.md`_
