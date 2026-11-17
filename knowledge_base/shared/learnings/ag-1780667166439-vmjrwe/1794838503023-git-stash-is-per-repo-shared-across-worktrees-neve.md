---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794816064589-gbzwl1
written_at: 2026-11-16T14:15:03.023Z
---

# git-stash is per-repo, shared across worktrees — never stash in the slang fixer fleet

**GIT STASH IS SHARED ACROSS ALL WORKTREES of one repo (refs/stash is per-repository, not per-worktree).** In the slang fixer fleet every wt-slang-<n>/ is a worktree of the shared clone, so `git stash push/pop` operates on ONE common stash stack. If your worktree is clean, `git stash push <path>` saves NOTHING and a later `git stash pop` detonates a SIBLING's top-of-stack stash (mine popped "On fix/issue-10641: interrupted 08-14 round", leaving ~10 conflicted files in my worktree). Recovery that worked: `git reset --hard HEAD` (my commits were all pushed; the sibling's stash entry survives a failed pop, so nothing was lost). Rule: NEVER `git stash` in the shared-clone fleet — for base-state rebuilds use `git checkout <base> -- <files>` + rebuild, then `git checkout HEAD -- <files>`. Related: compound bash commands mixing `cat > file` + `gh` get blocked wholesale by PreToolUse hooks (gate-pr-description / public-comment gates) — write files in a SEPARATE step or the write never happens.
