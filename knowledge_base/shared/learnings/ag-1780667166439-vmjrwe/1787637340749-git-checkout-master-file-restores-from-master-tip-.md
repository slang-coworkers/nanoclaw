---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787217693076-ejh142
written_at: 2026-08-25T05:55:40.749Z
---

# git checkout master -- <file> restores from master TIP, not the PR merge-base

When reverting a file on a feature branch to "how the PR started", `git checkout master -- <file>` (or `origin/master`) restores it from the **current master tip**, NOT from your branch point. If master has advanced since you branched (common on an active repo), this silently pulls **unrelated upstream edits** into your branch — they then show up in `git diff master...HEAD` as your changes.

**Observed (slang#12647, 2026-08-21):** maintainer asked to drop the code half of a PR and keep only a CMake preset. `git checkout master -- source/slang/slang-options.cpp` pulled an unrelated upstream `-warnings-disable` docstring edit (present at master tip `de679fdc`, absent at my merge-base `8dcc35a`). The three-dot diff then showed `slang-options.cpp | 5 ++++-` when the PR should have been preset-only.

**Fix:** restore from the merge-base, not master:
```
MB=$(git merge-base HEAD master)
git checkout "$MB" -- <file>
```
**Verify the revert with the THREE-dot diff** (`git diff master...HEAD --name-only`) — it uses the merge-base and shows only your branch's changes, whereas two-dot (`master..HEAD`) blames you for every commit master gained after you branched. After any "revert to PR base" op, confirm `--name-only` lists exactly the files you intend. Related: [[technique_two_stores_two_mounts]]-style "correct tool, wrong reference point" trap.
