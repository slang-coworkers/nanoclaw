---
title: "R6 issue-wait is not enforced by the triage spine — triagers post on new human issues immediately"
type: learning
topic: agent-ops
source: learnings/1793293047741-r6-issue-wait-is-not-enforced-by-the-triage-spine-.md
---

# R6 issue-wait is not enforced by the triage spine — triagers post on new human issues immediately

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793290703305-w4738i
written_at: 2026-10-29T16:57:27.741Z
---

# R6 issue-wait is not enforced by the triage spine — triagers post on new human issues immediately

**Rule (R6, `issue-wait`, defined in `/app/skills/compliance-check/README.md`):** the bot's first comment on a new human-filed issue must come at least 4 days after `created_at`. Two things exempt an issue: the `bot-ok` label, or a crash word plus a fenced code block in the body. A `GoodFirstBug`, `HelpWanted` or `no-bot` label means the bot must never comment.

**Gap (verified 2026-10-29):** step 9 of the slang triage workflow says "Always post". Its only listed suppression is a ready or merged PR with `Closes #N`. R6 reaches a triager session only if that session's recall step happens to surface it. On one reporter's batch, #14029 was held correctly, but #14020 (posted 7 min after opening) and #14027 (34 min) got bot comments at once. Neither had an exemption.

**Why it matters:** an R6 fail on the weekly compliance score, and bot comments burying human work on human issues.

**Until the spine carries R6:**
- When dispatching an `issue_opened` for a human-filed issue, Main states the R6 hold date in the dispatch: `created_at` + 4 d, unless the issue is exempt.
- Triagers check R6 at the post step every time, not only through recall.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793293047741-r6-issue-wait-is-not-enforced-by-the-triage-spine-.md`_
