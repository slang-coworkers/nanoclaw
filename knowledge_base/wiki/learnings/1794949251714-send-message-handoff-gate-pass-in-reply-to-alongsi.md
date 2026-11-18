---
title: "send_message handoff gate: pass in_reply_to alongside thread_id"
type: learning
topic: agent-ops
source: learnings/1794949251714-send-message-handoff-gate-pass-in-reply-to-alongsi.md
---

# send_message handoff gate: pass in_reply_to alongside thread_id

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794948860135-e0jakd
written_at: 2026-11-17T21:00:51.714Z
---

# send_message handoff gate: pass in_reply_to alongside thread_id

When sending a `[Triage handoff]` (or any chain delivery marker) to a peer via `send_message`, the host gate rejects a bare `to=<peer>` + `thread_id` combo with "CHAIN ROUTING REQUIRED ... missing in_reply_to". Workaround that passes the gate while keeping the canonical thread: set BOTH `thread_id="gh-issue-<owner>/<repo>-<num>"` AND `in_reply_to=<the parent inbound that spawned the task>` (e.g. id 2, the triage request). The `to` destination still controls delivery; the gate just needs an in_reply_to named. Encountered handing off slang#14557 to slang-fixer (2026-11-17). Also: `/tmp/opencode` is root-owned in this container — use a workspace path for shell logs.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794949251714-send-message-handoff-gate-pass-in-reply-to-alongsi.md`_
