---
title: "An action a peer attributes to you is not an action you hold — handshake or decline it back"
type: learning
topic: misc
source: learnings/1785831422368-an-action-a-peer-attributes-to-you-is-not-an-actio.md
---

# An action a peer attributes to you is not an action you hold — handshake or decline it back

## The shape

A close-out message ends with a line like: *"X is still unfiled, **you're asking the operator**, I don't
do it."* The sender has now (a) declined the action and (b) assigned it to you — **in one sentence, with
no acknowledgement from you.** If you read past it because it sounds plausible, the action is owned by
nobody while both sides believe it is covered.

Observed twice on the same fleet:

- **shader-slang/slang#11917 (batch-2)** — a dispatch each tier believed the other owned. Result: **7
  days of silence, no branch, no PR**, discovered only when the human asked a second time. The
  "hold for the report without polling" discipline is correct for noise but **has no deadline**, which is
  what converted a dropped handoff into invisible starvation.
- **shader-slang/slang#9866 (2026-08-04)** — triager's close-out: *"slice 2 still unfiled, you're asking
  the operator, I don't file it."* Nothing in the recipient's store recorded accepting that; its RESUME
  trigger was, and remained, "the maintainer answers." The filing sat unowned.

⭐⭐ **Attribution is not delegation.** A peer naming you as the owner of an action creates a *claim about*
ownership, not ownership. Only an explicit accept (recorded, with a trigger) or an explicit decline
resolves it.

## The check

When a peer's message assigns you an action:

1. **Grep your own store for the obligation.** If your notes on that chain don't record it, you don't
   hold it — the peer inferred it. Don't let a plausible attribution substitute for a handshake.
2. **Resolve it in the reply, one of two ways.** Accept: record it in the chain's file *with a named
   trigger*. Decline: say so back, so the peer knows it is still theirs or belongs to a human. Silence
   reads as acceptance to them and as non-existence to you.
3. **Re-derive the premise before acting on it either way.** Here, "slice 2 is unfiled" was true
   (`search/issues` ⇒ `total_count` 0), but the issue's `updated_at` looked like fresh activity and was
   in fact **our own bot's triage comment** — not a routing inbound, so the gate hadn't moved. A bot
   comment is never a reason to act; see the standing rule that your own prior post is a position, not a
   reply.
4. **Prefer "no action, and here's why" over a quiet no-op.** The failure mode isn't deciding not to act;
   it's leaving no record of who decided.

## Corollary — don't file a slice of someone else's open issue uninvited

The #9866 decision was **not** to file slice 2 and **not** to escalate: the maintainer's own OPEN issue
already carries both slices, and a public triage comment naming them makes the bug recorded and visible,
which is what a new issue would have bought. Splitting a slice out of a maintainer's self-filed issue,
uninvited, is the duplicate-issue trap. If the maintainer *asks* for the split, that request arrives as a
webhook and is the invitation.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785831422368-an-action-a-peer-attributes-to-you-is-not-an-actio.md`_
