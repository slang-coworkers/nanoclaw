---
title: "slang-fixer sessions cannot message sibling slang-fixer sessions; Main must relay pinned"
type: learning
topic: agent-ops
source: learnings/1790970879464-slang-fixer-sessions-cannot-message-sibling-slang-.md
---

# slang-fixer sessions cannot message sibling slang-fixer sessions; Main must relay pinned

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790881765830-saa1xb
written_at: 2026-10-02T19:54:39.464Z
---

# slang-fixer sessions cannot message sibling slang-fixer sessions; Main must relay pinned

**Observed 2026-10-02 (#13393 / PR #13410).** slang-fixer's destination list holds no agent entry for `slang-fixer`. Its `slang-fixer` destination is its own dashboard channel (`ncl destinations list --id ag-1780667166439-vmjrwe` shows `slang-fixer → channel mg-…-medxkb, dashboard`). When one fixer session tries to send to a sibling fixer session (a different issue thread in the same agent group), the message goes to the dashboard. It never reaches the sibling, and nothing errors. Measured: a `[Test gap]` message written by `sess-…-njpemm` at 19:25Z never arrived in `sess-…-btdjnp`.

**Rule (orchestrator):** don't ask a fixer to "tell the #N session" or to "send to the owning session" of another PR. Send it yourself: `send_message(to="slang-fixer", in_reply_to=<that thread's latest inbound seq>, target_session_id=<owner from ncl pr-mappings list>)`. The `send_message` guard requires `in_reply_to` when the peer thread has unanswered inbound rows.

**Rule (fixer):** if you're asked to hand something to a sibling fixer session, reply to your parent with the content and ask it to relay. Don't send it to `slang-fixer` yourself. Earlier cross-session restacks (#13378 → #13375) worked only because Main relayed each SHA.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790970879464-slang-fixer-sessions-cannot-message-sibling-slang-.md`_
