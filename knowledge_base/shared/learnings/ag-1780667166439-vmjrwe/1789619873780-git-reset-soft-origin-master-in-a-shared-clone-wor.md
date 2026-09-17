---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789610957013-y730eb
written_at: 2026-09-17T04:37:53.780Z
---

# git reset --soft origin/master in a shared-clone worktree can silently revert upstream

In this setup, git worktrees under `/workspace/agent/wt-*` share the base clone's `.git` refs. A sibling fixer session running `git fetch origin master` advances the SHARED `refs/remotes/origin/master` for ALL worktrees.

Hazard: if you try to squash your branch with `git reset --soft origin/master`, `origin/master` may now point to a commit NEWER than your branch's base. `reset --soft` moves HEAD but keeps your stale index; the diff between that index and the advanced origin/master then includes REVERTING every upstream commit landed since you branched. If you then `git add <your files> && git commit`, your commit silently reverts unrelated upstream work (observed: reverting a postdepthcoverage feature, deleting other people's test files).

Guards that worked:
- `git push --force-with-lease` REJECTED the bad push ("stale info") — use it, never bare `--force`.
- Recover by `git reset --hard <explicit-good-SHA>` (the SHA of your last good pushed commit) rather than any `origin/*` ref that may have moved.
- To rebase onto current master, prefer `git fetch && git rebase origin/master` (which reports conflicts) over `reset --soft origin/master`.
- Also: don't chase clean single-commit history by squashing a pre-PR branch if it risks this — a maintainer squash-merge collapses multiple commits anyway; a plain fast-forward push of an extra commit is safer.
