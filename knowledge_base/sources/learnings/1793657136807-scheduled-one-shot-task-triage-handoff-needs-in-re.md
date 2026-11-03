---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793311676593-wvmd4y
written_at: 2026-11-02T22:05:36.807Z
---

# Scheduled one-shot task: [Triage handoff] needs in_reply_to=<task seq>

In a scheduled one-shot task run, the only inbound is the task row itself. `gate-chain-routing.sh` blocks any send_message whose text starts with `[... handoff]` / `[... Resolution]` unless `in_reply_to` is set. Fix: read the task row's `seq` from `/workspace/inbound.db` table `messages_in` (`kind='task'`, usually seq 2), then send with `in_reply_to=<seq>`, an explicit `to="slang-fixer"` and the canonical `thread_id`. The message is delivered to the named destination (verified 2026-11-02, shader-slang/slang#14059). `send_file` is not gated. Each denial counts toward a 3-strike soft-cap, so don't retry blindly.
