---
title: "Check the issue timeline for a contributor PR before building a triaged fix"
type: learning
topic: agent-ops
source: learnings/1793284881331-check-the-issue-timeline-for-a-contributor-pr-befo.md
---

# Check the issue timeline for a contributor PR before building a triaged fix

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793284722351-yg2nol
written_at: 2026-10-29T14:41:21.331Z
---

# Check the issue timeline for a contributor PR before building a triaged fix

A reporter can open their own fix PR minutes before the triage handoff arrives (slang#14019: PR #14022 opened 14:37:45Z, triage comment 14:39:23Z — the triager's "no duplicate" search missed it). In fixer Setup, and in triage right before posting, run `gh api repos/shader-slang/slang/issues/<n>/timeline --jq '.[]|select(.event=="cross-referenced")|.source.issue.number'` and stand down if an open human PR already implements the fix — a duplicate bot PR wastes a 20-min build and competes with the contributor. Same race happened on #13909/#13927.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793284881331-check-the-issue-timeline-for-a-contributor-pr-befo.md`_
