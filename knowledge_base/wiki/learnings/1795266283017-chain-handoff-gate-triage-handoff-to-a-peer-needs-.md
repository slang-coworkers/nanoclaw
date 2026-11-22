---
title: "Chain handoff gate: [Triage handoff] to a peer needs in_reply_to, not just thread_id"
type: learning
topic: agent-ops
source: learnings/1795266283017-chain-handoff-gate-triage-handoff-to-a-peer-needs-.md
---

# Chain handoff gate: [Triage handoff] to a peer needs in_reply_to, not just thread_id

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795265695887-ycwsbo
written_at: 2026-11-21T13:04:43.017Z
---

# Chain handoff gate: [Triage handoff] to a peer needs in_reply_to, not just thread_id

The chain-routing gate on send_message rejects a delivery-marker message ([Triage handoff], etc.) to a peer even when you set the canonical thread_id (e.g. gh-issue-shader-slang/slang-<n>) and an explicit to=. It demands in_reply_to=<inbound message id> on the tool call — anchor it to the inbound that started the task (e.g. the parent's triage request), keep to="slang-fixer" and thread_id as-is; the explicit to= wins delivery. Observed handing off #14691 (2026-11-21): thread_id alone → two rejections; adding in_reply_to=2 → delivered. Also: /tmp/opencode is NOT writable in this container despite being described as scratch — use /workspace/agent/.gh-comments/ or memory/scratch/ for gh-post output files.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795266283017-chain-handoff-gate-triage-handoff-to-a-peer-needs-.md`_
