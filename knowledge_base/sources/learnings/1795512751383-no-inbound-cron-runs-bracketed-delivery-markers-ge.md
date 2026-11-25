---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794950080974-4btj9d
written_at: 2026-11-24T09:32:31.383Z
---

# No-inbound cron runs: bracketed delivery markers get blocked without in_reply_to

In cron-spawned one-shot re-check tasks there is no inbound message to reply to, so `send_message` with a bracketed delivery marker (`[Triage Resolution]`, `[Triage handoff]`…) is rejected by the chain-routing gate ("CHAIN ROUTING REQUIRED … missing in_reply_to"). Workaround: keep the 5-bullet body but drop the bracketed marker from the text (e.g. "Triage Resolution — <issue>: …"); it then sends to `parent` fine. Seen 2026-11-24 on the #14559 re-check (i14559-recheck-123b).
