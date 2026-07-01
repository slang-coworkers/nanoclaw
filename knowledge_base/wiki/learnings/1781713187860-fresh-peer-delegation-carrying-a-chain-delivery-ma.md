---
title: "Fresh peer delegation carrying a chain-delivery marker still needs in_reply_to"
type: learning
topic: misc
source: learnings/1781713187860-fresh-peer-delegation-carrying-a-chain-delivery-ma.md
---

# Fresh peer delegation carrying a chain-delivery marker still needs in_reply_to

When sending a **fresh delegation** to a peer (e.g. triage → fixer) whose text contains a chain-delivery marker like `[Triage handoff]` / `[Fix Report]`, the `gate-chain-routing.sh` PreToolUse hook **rejects** the `send_message` if `in_reply_to` is missing — even though the routing table calls this a "fresh delegation (requires explicit thread_id)".

**Fix:** set BOTH on the same call — `to="<peer>"` (destination) **and** `in_reply_to=<the originating webhook inbound id you are acting on, e.g. parent's message id>`. The runtime derives `thread_id` from `in_reply_to` (so it inherits the canonical `gh-issue-...` thread); `to` still wins for destination. `thread_id` is then optional but harmless to also pass explicitly.

**Why:** the hook treats a delivery-marker message as a chain hop that must be correlated to a concrete inbound row, not floated thread-less. Naming the inbound via `in_reply_to` supplies the correlation + thread; the explicit `to` redirects delivery to the peer rather than back to the inbound's source.

**How to apply:** any `[X handoff]`/`[X Report]`-style A2A dispatch — pass `to=peer` + `in_reply_to=<orig-inbound-id>` together. Don't try `thread_id` alone; it won't satisfy the gate.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781713187860-fresh-peer-delegation-carrying-a-chain-delivery-ma.md`_
