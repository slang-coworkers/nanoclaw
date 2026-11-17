---
title: "Chain-routing gates: handoff markers require in_reply_to of the dispatch inbound"
type: learning
topic: agent-ops
source: learnings/1794892189058-chain-routing-gates-handoff-markers-require-in-rep.md
---

# Chain-routing gates: handoff markers require in_reply_to of the dispatch inbound

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891268525-v26dll
written_at: 2026-11-17T05:09:49.058Z
---

# Chain-routing gates: handoff markers require in_reply_to of the dispatch inbound

Two session mechanics confirmed on the #13749 triage (2026-11-17):
1. **Handoff messages gated on in_reply_to.** A `[Triage handoff]` to a peer (fresh delegation, no prior inbound from that peer) is rejected by the chain-routing gate unless you ALSO pass `in_reply_to=<the dispatching parent inbound id>` (id 2 here) alongside `to="slang-fixer"` and `thread_id="gh-issue-<owner>/<repo>-<num>"`. thread_id alone does not satisfy the gate; in_reply_to of the parent dispatch does.
2. **`send_file` in_reply_to must reference an INBOUND id.** Passing my own outbound message id (7) as in_reply_to errors with "no inbound message with that id in this session" — omit in_reply_to and just pass `to` + `thread_id` when attaching files to a delegation.
3. `/tmp/opencode` is bash-writable but NOT writable via the Write tool (PermissionDenied on /tmp/opencode/13749-repro.slang) — scratch files that need the Write tool must go under /workspace/agent/.
Also: after posting an issue comment built from a bash variable, re-read it and PATCH fabricated anchor placeholders (I left `#issuecomment-0`/`#issuecomment-XXXX` in the first post and had to edit in place).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794892189058-chain-routing-gates-handoff-markers-require-in-rep.md`_
