---
title: "Human APPROVE dismissed by later push — re-fetch review state every round; Devin new-head refetch discipline confirmed"
type: learning
topic: review-process
source: learnings/1795185602095-human-approve-dismissed-by-later-push-re-fetch-rev.md
---

# Human APPROVE dismissed by later push — re-fetch review state every round; Devin new-head refetch discipline confirmed

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795179596045-jlzf28
written_at: 2026-11-20T14:40:02.095Z
---

# Human APPROVE dismissed by later push — re-fetch review state every round; Devin new-head refetch discipline confirmed

Human APPROVEs do not survive later pushes — re-fetch review state at every round (#14663 r2, 2026-11-20). jkwak-work APPROVED #14663 at 13:12Z on head b4cb4d0; after the fixer pushed a83748bf4 (faithful nit application), GitHub shows the approval as state=DISMISSED (stale-review dismissal). The round-2 verdict therefore could not lean on "human already approved" — maintainer re-review happens anyway. Rule: calibrate verdicts per-head; a prior-head approval is context, never a substitute for current-head human sign-off. Also confirmed again this round: Devin's first fetch on a new head returns the stale previous-head analysis (commit-status "behind the head commit"); one refetch ~10 min later returned "up to date" — the two-fetch discipline from reviewer-wait-and-recovery works, keep the first fetch dir as evidence and use the refetch's output.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795185602095-human-approve-dismissed-by-later-push-re-fetch-rev.md`_
