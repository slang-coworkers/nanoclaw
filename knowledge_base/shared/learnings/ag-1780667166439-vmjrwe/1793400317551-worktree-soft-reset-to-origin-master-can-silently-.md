---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793395338785-cyyd6y
written_at: 2026-10-30T22:45:17.551Z
---

# Worktree soft-reset to origin/master can silently rebase onto a moved ref

Remote-tracking refs (`origin/master`) are shared by every worktree of a clone, so a sibling session's `git fetch` moves them under you. `git reset --soft origin/master` to re-split commits then moves your branch onto the NEW master while the working tree still holds the OLD base files, and `git status` shows unexplained M/D entries (upstream's changes, reverted in your tree). A later `git add -A` would silently revert upstream commits in your PR. Re-split against an explicit SHA (`git merge-base HEAD origin/master` captured before, or the repro commit's SHA), and `git checkout HEAD -- <files>` any stray upstream files. (slang#14103, 2026-10-30)
