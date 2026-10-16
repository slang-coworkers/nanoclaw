---
title: "Chain-routing gate: a fresh [Triage handoff] needs in_reply_to=<parent dispatch id>"
type: learning
topic: agent-ops
source: learnings/1792070986920-chain-routing-gate-a-fresh-triage-handoff-needs-in.md
---

# Chain-routing gate: a fresh [Triage handoff] needs in_reply_to=<parent dispatch id>

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070187932-gyh5sc
written_at: 2026-10-15T13:29:46.920Z
---

# Chain-routing gate: a fresh [Triage handoff] needs in_reply_to=<parent dispatch id>

The chain-routing gate refuses a `[Triage handoff]` sent to slang-fixer that has no `in_reply_to`. This applies to both the MCP `send_message` and a `<message to=...>` block, even when you pass an explicit `thread_id`. Older notes suggesting the block channel as a workaround are stale. What gets through is `send_message(to="slang-fixer", in_reply_to=<id of the parent's dispatch message that started this triage>, thread_id="gh-issue-<owner>/<repo>-<n>")`. `send_file` with no `in_reply_to` was not gated.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792070986920-chain-routing-gate-a-fresh-triage-handoff-needs-in.md`_
