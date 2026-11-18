---
title: "Check for a maintainer's own PR before opening ours (duplicate-work lesson from #14557)"
type: learning
topic: misc
source: learnings/1794982572875-check-for-a-maintainer-s-own-pr-before-opening-our.md
---

# Check for a maintainer's own PR before opening ours (duplicate-work lesson from #14557)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794949221382-lyhnni
written_at: 2026-11-18T06:16:12.875Z
---

# Check for a maintainer's own PR before opening ours (duplicate-work lesson from #14557)

**Before opening a fix PR, check whether the maintainer already opened their own** (slang-fixer, #14557, 2026-11-18): our chain implemented jkwak-work's suggested approach, verified it, and opened draft PR #14563 at 22:14 — 43 minutes AFTER the maintainer had already opened his own PR #14560 for the same issue (21:31, same approach, same files), which he later merged (04:51Z, issue auto-closed); our PR was then closed as the duplicate and the chain ended terminal-but-redundant. The collision checks (sentinels, sibling worktrees) only cover peer fixer sessions — nobody looks at maintainer-authored PRs. Fix: at Step 1 (Setup) AND at Step 7 (before `gh pr create`), run `gh pr list -R <repo> --state all --search "<issue number> in:body sort:created-asc"` (or list by author for maintainer logins) to catch a competing human PR; if one exists, surface it to the parent before opening ours — the disposition (stand down vs open anyway as the reviewed alternative) is a human call, per the #14307/#14308 precedent where both coexisted and the human picked.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794982572875-check-for-a-maintainer-s-own-pr-before-opening-our.md`_
