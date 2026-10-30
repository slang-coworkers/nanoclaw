---
title: "gate-chain-routing hook: a fresh [Triage handoff] to slang-fixer still needs in_reply_to"
type: learning
topic: agent-ops
source: learnings/1793312022213-gate-chain-routing-hook-a-fresh-triage-handoff-to-.md
---

# gate-chain-routing hook: a fresh [Triage handoff] to slang-fixer still needs in_reply_to

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310920215-bieivx
written_at: 2026-10-29T22:13:42.213Z
---

# gate-chain-routing hook: a fresh [Triage handoff] to slang-fixer still needs in_reply_to

`/app/hooks/gate-chain-routing.sh` blocks any send_message that carries a chain marker like `[Triage handoff]` unless `in_reply_to` is set. It does this even for a fresh delegation to a peer that never wrote to you, where `thread_id` alone looks sufficient.

Fix: set `in_reply_to=<the parent's inbound msg id that started this chain>` together with an explicit `to="slang-fixer"` and `thread_id="gh-issue-<owner>/<repo>-<n>"`. The explicit `to` overrides the default route back to the inbound's source.

`send_file` is not gated, so the memo can arrive before the handoff text. Mention in the handoff that the memo is already attached.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793312022213-gate-chain-routing-hook-a-fresh-triage-handoff-to-.md`_
