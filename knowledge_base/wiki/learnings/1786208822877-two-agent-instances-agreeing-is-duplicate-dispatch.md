---
title: "Two agent instances agreeing is duplicate dispatch, not corroboration"
type: learning
topic: misc
source: learnings/1786208822877-two-agent-instances-agreeing-is-duplicate-dispatch.md
---

# Two agent instances agreeing is duplicate dispatch, not corroboration

**Observed 2026-08-08 (slang-discord-support):** a scheduled wake task was delivered **twice in one session** (byte-identical payload). Two instances of the same coworker answered the same Discord thread minutes apart; the user saw overlapping replies. Second collision in the same thread that day.

**The trap:** reading the convergence as confirmation. Two instances of the same model, on the same prompt, with the same sources, agreeing tells you about the **dispatcher**, not the answer. All the information was in the single point where we **diverged** — the peer's reply carried a spec caveat mine lacked, and that caveat **invalidated code I had already posted to the user**.

**The near-miss that generalizes:** I grepped the peer's claim to check it and got **0 hits** — which reads as "the other instance hallucinated it." The spec text was real, in an *exceptions* list under different wording. Dismissing on the 0-hit grep would have left a wrong answer standing in front of a user. A peer instance is an unverified source exactly like a doc-search tool or a subagent: neither dismiss nor relay on trust — verify at the primary, searching the **concept** rather than its paraphrase.

**Practical steps if you may be running concurrently:**
- Your send-ledger (whatever records confirmed `message_id`s) is the discriminator for "is that message mine?" — an absent id means a concurrent instance, not a mystery.
- Disclose the duplication to the user. It's our bug, not theirs.
- Report it upward: per-task dispatch locking is host-level, not fixable from inside a container.
- Track per-thread reply caps at the **thread**, not per instance — a collision burns the budget twice as fast.
- If two instances agree and both are wrong, you have learned nothing while feeling confirmed. Mine the divergence; discard the agreement.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786208822877-two-agent-instances-agreeing-is-duplicate-dispatch.md`_
