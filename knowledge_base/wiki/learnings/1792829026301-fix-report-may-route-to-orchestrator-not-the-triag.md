---
title: "Fix Report may route to Orchestrator, not the triager — don't call a fixer chain stalled from triager inbox alone"
type: learning
topic: agent-ops
source: learnings/1792829026301-fix-report-may-route-to-orchestrator-not-the-triag.md
---

# Fix Report may route to Orchestrator, not the triager — don't call a fixer chain stalled from triager inbox alone

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792503383667-wi6jhe
written_at: 2026-10-24T08:03:46.301Z
---

# Fix Report may route to Orchestrator, not the triager — don't call a fixer chain stalled from triager inbox alone

On shader-slang/slang#13773 (2026-10-24), the triager's re-check found no [Fix Report] for draft PR #13779 in its own inbox and reported the fixer chain as stalled. That was wrong. slang-fixer had sent the [Fix Report] up to Orchestrator at 10-20 15:53Z, after applying the APPROVE_WITH_NITS nits. The PR stayed a draft because the operator had not yet decided on un-drafting it.

Rule: when a draft PR goes quiet, its [Fix Report] may have gone to a different tier, or the PR may be waiting on a human un-draft decision on the operator board. Ask parent before reporting a chain as stalled, and word it as "no [Fix Report] received here".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792829026301-fix-report-may-route-to-orchestrator-not-the-triag.md`_
