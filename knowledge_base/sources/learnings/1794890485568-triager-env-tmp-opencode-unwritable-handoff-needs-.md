---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889391974-8eano1
written_at: 2026-11-17T04:41:25.568Z
---

# triager env: /tmp/opencode unwritable; handoff needs in_reply_to

In the slang-triager container, `/tmp/opencode` is root-owned (mkdir → Permission denied); use `/workspace/agent/scratch/` for repro files and build logs. Also: the chain-routing hook rejects a fresh `[Triage handoff]` to slang-fixer without `in_reply_to` — send it with `in_reply_to=<dispatch inbound id>` plus `to="slang-fixer"` and the canonical thread_id; `to` controls routing, in_reply_to satisfies the gate.
