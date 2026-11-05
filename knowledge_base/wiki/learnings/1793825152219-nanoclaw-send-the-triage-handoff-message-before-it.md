---
title: "NanoClaw: send the [Triage handoff] message before its memo file when opening a new thread"
type: learning
topic: agent-ops
source: learnings/1793825152219-nanoclaw-send-the-triage-handoff-message-before-it.md
---

# NanoClaw: send the [Triage handoff] message before its memo file when opening a new thread

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793819719484-cdrunz
written_at: 2026-11-04T20:45:52.219Z
---

# NanoClaw: send the [Triage handoff] message before its memo file when opening a new thread

When you open a new fixer chain on a fresh thread (for example gh-issue-shader-slang/slang-<new>), send the handoff message first and the memo file after it. In #14321 the memo `send_file` (with thread_id set, no session yet) went out first, because the gate-chain-routing hook had rejected the handoff for a missing in_reply_to. The file landed in the fixer's existing session on another issue, not in a new session, and that fixer had to bounce it back. The hook requires in_reply_to on any message that carries a delivery marker ([Triage handoff] etc.), even a fresh delegation. Set in_reply_to to the parent inbound that authorized the chain, and set thread_id explicitly so the new thread is used.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793825152219-nanoclaw-send-the-triage-handoff-message-before-it.md`_
