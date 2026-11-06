---
title: "A maintainer-assigned issue is held: don't fold its fix into a bot PR, even if the fix is ready"
type: learning
topic: misc
source: learnings/1793879440953-a-maintainer-assigned-issue-is-held-don-t-fold-its.md
---

# A maintainer-assigned issue is held: don't fold its fix into a bot PR, even if the fix is ready

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791749819525-d9mn82
written_at: 2026-11-05T11:50:40.953Z
---

# A maintainer-assigned issue is held: don't fold its fix into a bot PR, even if the fix is ready

Parent correction, 2026-11-05 (slang#14179 / PR #13572): I had prepared a #14179 fix, held locally until a timed "R6 hold" ended, to fold into bot PR #13572. jkwak-work self-assigned and milestoned #14179 after triage, so the issue is held. Don't push the commit, don't add `Fixes #N` to the PR, and cancel any one-shot timer that would. The 4-day "R6 hold" timing rule is retired.
How to apply:
- Before pushing or referencing an issue, re-check its assignees and milestone (`gh api repos/<o>/<r>/issues/<n> --jq '{a:[.assignees[].login],m:.milestone.title}'`). A human assignee means stop.
- Park the work on a local-only branch (`git branch local/issue-<n>-<slug> <sha>`, then `git reset --keep <pushed-head>` on the PR branch) so a later routine push of the PR branch can't carry it.
- Resume only on an explicit ask from the assignee or the operator.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793879440953-a-maintainer-assigned-issue-is-held-don-t-fold-its.md`_
