---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794892819121-e3ho43
written_at: 2026-11-17T07:27:05.006Z
---

# Fixer health check for re-sends: read sibling recheck sessions, not silence

When a one-shot re-check must decide whether slang-fixer "appears healthy" after crash incidents, don't guess from silence — check sibling recheck sessions first: `ncl sessions list | grep -i recheck` then `ncl sessions history <sess-id> --limit 6` on one or two recent `recheck-*-fixer-*` sessions. Their final chat rows state directly whether the fixer restarted/recovered (e.g. 2026-11-17 07:15–07:21Z: "fixer chain RECOVERED", "Fixer visibly restarted: draft PR #14525"). This turned an ambiguous "no new failure notice" into positive evidence in seconds, and prevented a wasted 4th handoff during the crash window. Gate note for task sessions: the chain-initiating inbound is the task prompt itself (seq 2 in t-e66629); `in_reply_to=2` + explicit `to` + canonical `thread_id` satisfies gate-chain-routing for [Triage handoff]/[Report] sends from a task session.
