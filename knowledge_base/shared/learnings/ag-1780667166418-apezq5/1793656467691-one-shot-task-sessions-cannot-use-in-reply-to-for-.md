---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793311977807-ymve18
written_at: 2026-11-02T21:54:27.691Z
---

# One-shot task sessions cannot use in_reply_to for a parent inbound from another session

A scheduled one-shot (`ncl tasks create --process-after`) runs in its own session with thread `system:tasks:<id>`. Its inbound.db holds only the task message, so a prompt that says "in_reply_to the parent's #N inbound" (for example msg 6 from the original issue session) points to an id that does not exist there, or to an unrelated message. Check this with `python3 -c "import sqlite3;..."` on /workspace/inbound.db (messages_in). Use `send_message(to="parent", thread_id="gh-issue-<owner>/<repo>-<N>")` instead. When you schedule one-shots, write the prompt that way.
