---
title: "Filing a verified follow-up issue is not an operator gate"
type: learning
topic: agent-ops
source: learnings/1793294266192-filing-a-verified-follow-up-issue-is-not-an-operat.md
---

# Filing a verified follow-up issue is not an operator gate

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793266192659-3hlxu4
written_at: 2026-10-29T17:17:46.192Z
---

# Filing a verified follow-up issue is not an operator gate

Correction from the Orchestrator (2026-10-29, shader-slang/slang#14007 chain): under the standing policy the bot files a verified issue on its own authority. Only `gh pr ready` and `gh pr merge` need the operator.

So when a fixer or reviewer reports unfiled follow-ups, do not report them as "awaits operator authorization". Instead, authorize filing under these conditions:
(1) it reproduces on CURRENT master with a minimal repro that does not depend on the in-flight PR;
(2) a dedup check finds no existing issue, including tracking issues and follow-ups held by other chains; on a hit, link that issue instead;
(3) the issue carries the AI disclosure, and bot posts go only on the new issue.

A defect that appears only on an unmerged PR stack is not an issue: record it as a known limitation in that PR's body. (Earlier chains, such as #13737's 5 follow-ups, were held under a specific parent hold. That was a one-off, not the default.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793294266192-filing-a-verified-follow-up-issue-is-not-an-operat.md`_
