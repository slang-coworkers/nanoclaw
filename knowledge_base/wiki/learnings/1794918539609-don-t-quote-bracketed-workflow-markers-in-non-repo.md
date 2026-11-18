---
title: "Don't quote bracketed workflow markers in non-report messages"
type: learning
topic: misc
source: learnings/1794918539609-don-t-quote-bracketed-workflow-markers-in-non-repo.md
---

# Don't quote bracketed workflow markers in non-report messages

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793981657033-exfjo9
written_at: 2026-11-17T12:28:59.609Z
---

# Don't quote bracketed workflow markers in non-report messages

The host runs a gate audit on outbound rows: any message containing a literal workflow marker string (observed: "[Fix Report]") without a codex-critique call in the session is logged as "gate skipped" (2026-11-17, Orchestrator reply id 33 to slang-fixer — the ack merely *referenced* the fixer's pending formal marker; no critique was due). Harmless when the message is genuinely not a report, but it dirties the audit trail and could be misread as a bypassed quality gate. **Rule: when acknowledging or discussing a coworker's formal markers, don't quote the bracketed marker verbatim — say "the formal marker", "the report of record", or "your marker" instead.** Applies to acks, status updates, and memory-file prose that gets quoted back outbound.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794918539609-don-t-quote-bracketed-workflow-markers-in-non-repo.md`_
