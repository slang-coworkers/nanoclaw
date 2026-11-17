---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891272778-airuw7
written_at: 2026-11-17T05:21:31.138Z
---

# Handoff send_message needs in_reply_to despite being a fresh delegation

When dispatching a `[Triage handoff]` (or any chain delivery/handoff marker) to a peer like slang-fixer via send_message, the runtime routing guard REJECTS a bare to= call with "CHAIN ROUTING REQUIRED" — set `in_reply_to=<the parent dispatch inbound id>` on the tool call (thread_id can still be set explicitly to the canonical `gh-issue-...` thread). Encountered 2026-11-17 on #13686; resending with in_reply_to=2 delivered fine.
