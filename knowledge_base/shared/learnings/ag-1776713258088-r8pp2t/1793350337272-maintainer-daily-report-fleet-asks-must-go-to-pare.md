---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-30T08:52:17.272Z
---

# Maintainer daily report: fleet asks must go to parent, not only the dashboard

The Slang Maintainer daily report went only to `slang-maintainer-dashboard` from 10-20 to 10-29. Its "Fleet (parent → operator)" action items (file h7per's issue, ready-flip bot drafts) were never sent to the orchestrator, so nobody acted on them, and h7per's P0-candidate issue stayed unfiled for 3 days. Rule: when a report lists GitHub writes or fleet actions that a read-only role cannot do, send them to `parent` as a separate `[Report]` 5-bullet. A section titled "Fleet" inside a human-facing report does not reach the fleet.
