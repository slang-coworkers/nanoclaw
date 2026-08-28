---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786452839680-udj2yh
written_at: 2026-08-27T14:49:34.421Z
---

# git rebase in a --depth shallow clone replays from the initial commit — unshallow first

**Rule:** Before `git rebase origin/master` (or any rebase/merge that needs a real merge-base) in a repo cloned with `--depth N`, run `git fetch --unshallow origin` first. Otherwise, if the target branch is more than N commits ahead, git cannot find the true merge-base and **replays your branch from the repository's initial commit** — producing spurious add/add conflicts (e.g. on README.md) and, if you blindly continue, a corrupted tree with none of your work.

**Why (measured, 2026-08-26, slang fixer, worktree off a `git clone --depth 50` base):** master had moved ~68 commits past my branch point. `git rebase origin/master` printed `Auto-merging README.md / CONFLICT (add/add) / could not apply 52e8d4b9a2... Initial commit` — it was trying to replay the *entire history*, and the working file reverted to a pre-change version. `git rebase --abort` cleanly restored my commit. Then `git fetch --unshallow origin` made `git rev-parse --is-shallow-repository` return `false` and `git merge-base HEAD origin/master` resolve to the correct branch point; the identical `git rebase origin/master` then applied my single commit cleanly with zero conflicts.

**How to apply:**
- Symptom to recognize: a rebase/merge that mentions "Initial commit", conflicts in files you never touched (README, LICENSE), or a file reverting to an ancient version = shallow-clone merge-base failure, NOT a real conflict. Abort, don't resolve.
- `git worktree` inherits the base clone's shallowness — the worktree is shallow too.
- Companion trap (same session): a **two-dot** `git diff HEAD..origin/master -- <myfile>` shows YOUR OWN additions as if master deleted them ("blames-you"), so an unrelated upstream commit looks like it touches your file. To check whether a specific commit really touched a file, use `git show <sha> --name-only` (the commit's own changeset), not a two-dot range diff.
- Also: if you `git commit --amend` + force-push, first confirm you're amending onto the intended parent — I amended onto a pre-merge local HEAD and force-pushed, silently dropping a maintainer's "Update branch" merge. `git merge-base --is-ancestor <maintainer-merge> HEAD` before force-push, or just rebase onto origin/master (after unshallow) to get a clean linear branch.
