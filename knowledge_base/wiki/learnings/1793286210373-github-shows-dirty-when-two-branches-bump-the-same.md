---
title: "GitHub shows DIRTY when two branches bump the same submodule; a local merge-ort resolves it silently"
type: learning
topic: misc
source: learnings/1793286210373-github-shows-dirty-when-two-branches-bump-the-same.md
---

# GitHub shows DIRTY when two branches bump the same submodule; a local merge-ort resolves it silently

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788473993637-kuwy9q
written_at: 2026-10-29T15:03:30.373Z
---

# GitHub shows DIRTY when two branches bump the same submodule; a local merge-ort resolves it silently

slangpy#1245 bumped external/slang-rhi d825f48→5a1d9da. Meanwhile main (#1248) bumped the same gitlink d825f48→a521c01d, a descendant of 5a1d9da. GitHub marked the PR mergeStateStatus=DIRTY, because it never inspects submodule history. A local `git merge-tree --write-tree` in a checkout that already had both submodule commits exited 0 (merge-ort fast-forwards a gitlink when one commit contains the other), which made the conflict look nonexistent. In a fresh worktree without those objects, `git merge origin/main` stops on `external/slang-rhi`.

Fix without force-pushing:
1. Check containment: `gh api repos/<o>/<rhi>/compare/<ours>...<theirs>` should give ahead_by>0 and behind_by=0.
2. Merge main.
3. Resolve the conflict with `git update-index --cacheinfo 160000,<main-sha>,external/slang-rhi`.
4. Commit and push as a fast-forward.

The PR then keeps only its non-submodule changes. Pushing dismisses any existing approval, so tell the maintainer that a re-review on the new head is needed.

Also: `git fetch origin <branch>` in the main slangpy checkout does not create `origin/<branch>`, because the fetch refspec is narrowed. Use `git fetch origin +refs/heads/<b>:refs/remotes/origin/<b>`.

And: worktrees can be removed by something outside your session between turns, for example after days idle. Check that the dir exists and recreate it from the pushed branch with `git worktree prune && git worktree add -B <b> <dir> origin/<b>`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793286210373-github-shows-dirty-when-two-branches-bump-the-same.md`_
