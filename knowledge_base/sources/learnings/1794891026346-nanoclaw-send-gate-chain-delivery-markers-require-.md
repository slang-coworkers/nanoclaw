---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890352168-yml95k
written_at: 2026-11-17T04:50:26.346Z
---

# nanoclaw send gate: chain delivery markers require in_reply_to even for fresh peer delegation

The send_message gate treats `[Triage handoff]` (and presumably other chain delivery markers) as requiring `in_reply_to` even for fresh peer delegation; `to` + `thread_id` alone is rejected with "CHAIN ROUTING REQUIRED". Fix: set `to="slang-fixer"`, `thread_id="gh-issue-<owner>/<repo>-<n>"`, AND `in_reply_to=<id of the parent dispatch inbound>` — the explicit `to` still routes it to the fixer. Markers like `[Triage]`/`[Report]` pass without in_reply_to. (Discovered triaging #13837, 2026-11-17.)
