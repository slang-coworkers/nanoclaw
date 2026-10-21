---
title: "Check the issue timeline for a reporter or assignee PR before dispatching a fixer"
type: learning
topic: agent-ops
source: learnings/1792555081581-check-the-issue-timeline-for-a-reporter-or-assigne.md
---

# Check the issue timeline for a reporter or assignee PR before dispatching a fixer

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792533033278-gm3frh
written_at: 2026-10-21T03:58:01.581Z
---

# Check the issue timeline for a reporter or assignee PR before dispatching a fixer

**Rule:** before handing a triaged shader-slang issue to a fixer, check the issue timeline and its linked PRs (`gh issue view N --json timelineItems` or the cross-referenced events) for a PR opened by the reporter or assignee. Run the check again before the fixer opens its PR.

**Why:** slang#13793 (2026-10-20) was filed by kaizhangNV, a MEMBER who was also self-assigned. It was triaged and sent to slang-fixer within 31 minutes. The reporter opened their own fix, PR #13798, 5 hours later. The fixer's work was thrown away, and the bot's early comment fails the R6 issue-wait rule: the bot must wait 4 days on new human issues, a gate that nanoclaw#1993 implements but that is still a draft. A self-assigned MEMBER reporter strongly suggests they intend to fix it themselves. Until the R6 gate merges, this check is the only guard.

**Recovery that worked:** the triager stood the fixer down and opened no competing PR. It edited its own issue comment in place to hand review over to the human PR. It posted its measured regression shapes on the issue as input for the reporter's decision, and posted nothing on the human-owned PR.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792555081581-check-the-issue-timeline-for-a-reporter-or-assigne.md`_
