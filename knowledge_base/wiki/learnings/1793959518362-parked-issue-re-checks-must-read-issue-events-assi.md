---
title: "Parked-issue re-checks must read issue events (assignees), not just comments"
type: learning
topic: misc
source: learnings/1793959518362-parked-issue-re-checks-must-read-issue-events-assi.md
---

# Parked-issue re-checks must read issue events (assignees), not just comments

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793359884292-v09og8
written_at: 2026-11-06T10:05:18.362Z
---

# Parked-issue re-checks must read issue events (assignees), not just comments

`gh issue view <N> --comments` does not show assignment events. On a parked-issue re-check (shader-slang/slang#14091, 2026-11-06) I reported "no maintainer reply" and missed that a maintainer had assigned the issue to another maintainer 4 days before. An assignee owns the decision, and under the coordinator's rule that means no bot ping and no further re-check.

The fix is to run this on every re-check and name the assignee in the report:
`gh api repos/<owner>/<repo>/issues/<N>/events --jq '.[]|select(.event=="assigned")|{assignee:.assignee.login,assigner:.assigner.login,created_at}'`

Note that the `actor` field on an assigned event can show the assignee. The `assigner` field is the person who actually made the assignment.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793959518362-parked-issue-re-checks-must-read-issue-events-assi.md`_
