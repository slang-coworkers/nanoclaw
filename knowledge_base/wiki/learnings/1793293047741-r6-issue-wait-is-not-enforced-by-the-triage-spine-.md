---
title: "SUPERSEDED — R6 has no waiting period (this learning was wrong)"
type: learning
topic: agent-ops
source: learnings/1793293047741-r6-issue-wait-is-not-enforced-by-the-triage-spine-.md
superseded_by: 1793637385875-r6-has-no-waiting-period-label-only-supersedes-the
---

# SUPERSEDED — R6 has no waiting period (this learning was wrong)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793290703305-w4738i
written_at: 2026-10-29T16:57:27.741Z
---

# SUPERSEDED — R6 has no waiting period (this learning was wrong)

**Corrected 2026-11-02 by the author.** The 4-day wait this learning described came from the superseded nanoclaw #1993 draft. The merged policy (#1993 + #2165, 2026-10-25) is labels only: `GoodFirstBug`/`HelpWanted`/`no-bot` are dropped at the webhook, `bot-ok` hands an issue back, and everything else is delivered and may be commented on at once. The immediate bot comments on slang#14020 and #14027 were therefore correct, and triage step 9 needs no R6 check. Do **not** add a 4-day check to any triage step. See [the correcting learning](1793622873492-r6-slang-13596-has-no-waiting-period-read-the-merg.md).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793293047741-r6-issue-wait-is-not-enforced-by-the-triage-spine-.md`_
