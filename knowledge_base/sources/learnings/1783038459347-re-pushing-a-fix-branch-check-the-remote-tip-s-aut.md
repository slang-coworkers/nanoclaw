# Re-pushing a fix branch: check the remote tip's AUTHOR first — a maintainer may have pushed (merge/commits); never force over it

**Rule:** Before force-pushing an amended commit to your `fix/issue-<n>` branch, ALWAYS run `git ls-remote origin <branch>` and inspect the remote tip's **author and parent** (`git log -1 --format='%an %s' <sha>`, `git rev-parse <sha>^`). If the tip is NOT your own prior bot commit — e.g. a human maintainer merged `master` into the branch or pushed fixes — a force-push would **destroy their work**.

**What happened (slang#11669, PR #11816, 2026-07-03):** I amended my fix locally and `git push --force-with-lease` → rejected "stale info". Instead of forcing through, I checked: the remote tip `83a1760` was authored by *"Harsh Aggarwal (NVIDIA)"* — a "Merge branch 'master' into fix/issue-11669" (maintainer had merged current master to clear a stale-base CI failure). My local amend was based on the old pre-merge base. A plain `--force` would have wiped the maintainer's merge.

**Non-destructive recovery (fast-forward-on-top):**
1. Save your delta as a patch: `git diff <your-original-fix-commit> <your-amended-HEAD> > /tmp/refine.patch` (the pure refinement, since both share the same base).
2. Verify the merge didn't alter your files: `git diff <orig-fix> <merge-tip> -- <your files>` (empty = clean) and that the patch applies: `git apply --check /tmp/refine.patch`.
3. `git reset --hard <merge-tip>` (fetch it first; your amend stays in reflog).
4. `git submodule update --init` (a master-merge often pulls new submodule commits — expect build breaks otherwise, e.g. fast_float/imgui).
5. `git apply /tmp/refine.patch`, rebuild **on the merged base** (CI builds there; your prior verification on the stale base doesn't count), re-verify.
6. Commit as a NEW commit on top of the merge and **plain `git push`** — it's a fast-forward (`git merge-base --is-ancestor <remote-tip> HEAD` → YES). No force. Squash-merge collapses the intermediate commits anyway.
7. Re-fetch the tip immediately before pushing to confirm it hasn't moved again.

**Why `--force-with-lease` "stale info" is a tell:** in a worktree the tracking ref `origin/<branch>` may not be materialized, so the lease can't be evaluated — but the rejection is also your cue to STOP and inspect the remote before reaching for plain `--force`. Treat every force-push-lease rejection as "someone/something changed the remote; verify what."
