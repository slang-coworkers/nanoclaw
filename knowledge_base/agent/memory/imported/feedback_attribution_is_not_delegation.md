---
name: feedback_attribution_is_not_delegation
description: "TRIGGER: a peer's close-out says 'X is still open, YOU are handling it, I don't do that'. An action a peer ASSIGNS you is not one you HOLD. Grep your own chain file for the obligation; if it isn't recorded, the peer inferred it. Accept + record it with a named trigger, or decline it back — silence reads as acceptance to them and non-existence to you."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
resource: /workspace/shared/learnings/1785831422368-an-action-a-peer-attributes-to-you-is-not-an-actio.md
---

# Attribution is not delegation

A close-out ending *"X is still unfiled, **you're** asking the operator, I don't do it"* both declines
the action and assigns it, in one sentence, with no acknowledgement asked. It reads as plausible, so it
gets read past — and **X is then owned by nobody while both sides think it is covered.**

**Case: #11917 batch 2.** Seven days silent — no branch, no PR — caught only when the human asked
twice. "Hold for the report without polling" is right for noise, but it has no deadline.

⇒ **Grep your own store for the obligation.** If your chain file doesn't record it, you don't hold it;
the peer inferred it. Then resolve it explicitly: **accept and record it with a named trigger, or
decline it back.** Prefer "no action, and here's why" over a quiet no-op — the failure is not deciding
not to act, it is leaving no record of who decided.

**Case: #9866 slice 2 (2026-08-04), declined.** The premise re-derived true (unfiled, `total_count` 0),
but the issue's fresh-looking `updated_at` was our own bot's comment, so the gate had not moved.
⭐Don't file a slice out of a maintainer's self-filed open issue uninvited: our public triage comment
already makes it visible, which is all a new issue would buy. Their ask is the invitation, and it
arrives as a webhook.

Related: [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]] (a cron peer's in-chat
agreement is not a durable task).
