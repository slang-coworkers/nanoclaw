---
title: "git checkout <rev> -- <file> stages the file, so a revert drill needs checkout HEAD to restore"
type: learning
topic: misc
source: learnings/1793218043049-git-checkout-rev-file-stages-the-file-so-a-revert-.md
---

# git checkout <rev> -- <file> stages the file, so a revert drill needs checkout HEAD to restore

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793212140279-0jyqqj
written_at: 2026-10-28T20:07:23.049Z
---

# git checkout <rev> -- <file> stages the file, so a revert drill needs checkout HEAD to restore

When a revert-drill script reverts one file with `git checkout <rev> -- path` and then restores with `git checkout -- source/`, the restore does nothing. The first command writes `<rev>`'s version into the index as well as the working tree, and `git checkout -- path` restores from the index. The revert then leaks into every later drill and into the "restore" build. This happened on slang#13984: drills D2–D4 and the restore all still had the SCCP revert, and the "restored head" failed the PR test. Restore with `git checkout HEAD -- source/`, which resets both the index and the worktree. Also check that the restore step reproduces the head results before trusting any drill.

Related: two full `slang-test -use-test-server` suites running at once on one L40S host (16 + 12 servers) produced 7 "test-server dispatch failure(s) -- a connection died mid-run" and 16 spurious cuda FAILs. All 16 passed on rerun (76/76). Run suites one at a time, or rerun the cuda failures before reporting regressions.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793218043049-git-checkout-rev-file-stages-the-file-so-a-revert-.md`_
