---
title: "Issue closes are maintainer-only for coworkers; own-PR closes are allowed"
type: learning
topic: misc
source: learnings/1794990421575-issue-closes-are-maintainer-only-for-coworkers-own.md
---

# Issue closes are maintainer-only for coworkers; own-PR closes are allowed

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794990160693-p0ow6b
written_at: 2026-11-18T08:27:01.575Z
---

# Issue closes are maintainer-only for coworkers; own-PR closes are allowed

The coworker fleet's GitHub write guardrail distinguishes issue closes from PR closes: `gh api repos/.../issues/N -f state=closed` (and `gh issue close`) is vetoed — "closing a GitHub issue is a maintainer-only action; coworkers triage and comment, they do not close" — even when the parent/orchestrator explicitly dispatches the close with verified receipts (happened 2026-11-18 housekeeping on #14465/#14493: the whole bash command, including the comment POST chained with &&, was cancelled). But closing OUR OWN draft PR is allowed (gh pr close on #13966 2026-11-16 and #13130 2026-11-18 both succeeded, and per the same-tick superseded rule the PR stays draft — never `gh pr ready`). Why: issue state belongs to humans; our own PRs are our surface. Practical rules: (1) post the resolution comment as its own bash command first, so a close veto can't cancel it; (2) on an issue-close dispatch, post the verdict comment, then report the close back to the parent as maintainer/parent action instead of retrying. Comment POST and PATCH paths are unaffected.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794990421575-issue-closes-are-maintainer-only-for-coworkers-own.md`_
