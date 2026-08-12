# gh compare behind_by/ahead_by are relative to the FIRST ref — one call cannot tell you who is behind

**Rule:** In `gh api repos/O/R/compare/<A>...<B>`, `ahead_by`/`behind_by` are reported **for B relative
to base A**. So `compare/<branch>...master` returns `ahead_by: 282, behind_by: 4` meaning *master is
282 ahead of the branch, and the branch has 4 commits master lacks* — the branch is **282 behind**,
not 4. Read one call in isolation and you will state the staleness backwards by two orders of
magnitude.

**Two-arm control that settles it (run both, same instant):**
```bash
gh api "repos/O/R/compare/master...my-branch?per_page=1" --jq '{dir:"master...branch",ahead_by,behind_by}'
# {"ahead_by":4,"behind_by":282}   <- branch is 4 ahead of master, 282 behind
gh api "repos/O/R/compare/my-branch...master?per_page=1" --jq '{dir:"branch...master",ahead_by,behind_by}'
# {"ahead_by":282,"behind_by":4}   <- the SAME two numbers, swapped
```
The numbers are symmetric, so the output looks equally plausible either way — nothing in the response
marks which ref was the base. That is what makes it silent.

**Observed (slang#11820, 2026-08-07):** a `behind_by: 4` reading nearly became "the branch is only 4
commits stale, BEHIND is cosmetic." The true figure was **282 upstream commits since the merge-base**,
36 of which touched the PR's four non-test files — including a change that added a whole new
warning-level mechanism the PR's new diagnostic interacts with. Opposite verdict.

**How to apply:**
- Prefer an unambiguous local count over the API's labels:
  `git rev-list --count <merge_base>..origin/master` (how far the base moved) and
  `git rev-list --count <merge_base>..<head>` (your own commits). Take `merge_base` from
  `.merge_base_commit.sha` in the compare response, not from the base ref name.
- To decide whether a rebase is *material*, count upstream commits **restricted to your changed
  files**: `git log --oneline <merge_base>..origin/master -- <your files>`. A nonzero count is
  overlap; zero means the existing CI green may still bind.
- `git merge-tree --write-tree --messages origin/master <head>` detects textual conflicts with **no
  worktree mutation** (rc=0 = clean auto-merge). Note it says nothing about *semantic* interaction —
  a clean merge can still invalidate a green if upstream changed a mechanism your code or tests rely
  on.
- ⚠ The compare API also caps `.files` at 300 entries, so it silently under-reports large ranges; use
  `git diff --name-only` for the base side.
