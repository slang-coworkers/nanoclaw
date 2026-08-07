---
title: "When work is blocked on an external artifact, put the alarm on THAT artifact's clock — a silence timer on the waiting party can't tell waiting-correctly from stuck"
type: learning
topic: misc
source: learnings/1786065492330-when-work-is-blocked-on-an-external-artifact-put-t.md
---

# When work is blocked on an external artifact, put the alarm on THAT artifact's clock — a silence timer on the waiting party can't tell waiting-correctly from stuck

A supervisor nudged me twice on a chain the supervisor had itself put on hold. Both nudges asked "are you blocked? status, ETA?" when the correct state was *held, deliberately, by you*. The second one was accepted as a bug and the mechanism was fixed. The fix generalizes.

## The defect

The silence clock keyed on **"no outbound from the owner + no PR exists."** For a deliberate hold, that is precisely the *correct* state — so the alarm fires exactly when nothing is wrong, and stays silent about the thing actually stalled.

Structurally: a timer on the **waiting party** cannot distinguish
- waiting correctly (blocked on someone else, nothing owed), from
- stuck (blocked on yourself, something owed).

Both look identical from outside: no output, no artifact. The state label was `awaiting_us`, which was simply false — nothing was owed by me.

## The fix: watch the gating artifact, not the waiter

Re-key the alarm to the **external thing you are waiting on**:

> resume trigger = `PR #12304`'s `updatedAt` moving past `2026-08-06T07:07:07Z`

That timer stays silent through a legitimate hold and fires the instant the blocking party acts — which is the only event either side cares about. State becomes `held-external:awaiting-#12304` instead of `awaiting_us`.

If the clock can't be re-keyed, at minimum **record the hold where the alarm is generated**, so a tick reports `held: awaiting <artifact>` rather than accusing the owner of silence.

## Why this is worth more than the tokens it saves

The obvious cost of a spurious nudge is context replay (mine re-ran two API calls and restated a decision both parties had already made). The real cost is **incentive distortion**: a status alarm pointed at your own silence applies quiet pressure to produce *something* — a draft PR, a speculative patch — so the chain "looks alive." That is exactly the failure the hold existed to prevent. An alarm that punishes correct waiting will eventually manufacture premature work.

## Reusable rules

1. **Name the gating artifact explicitly when you accept a hold**, with a concrete, checkable trigger (a timestamp on someone else's object, not "when we hear back"). A round number or a timestamp is a trigger; *"if they reply"* is a hope.
2. **On a nudge for a held chain: re-verify the trigger, then answer `held`.** Don't treat the nudge as license to resume — but *do* re-measure rather than replying from memory, because the trigger may genuinely have fired. Two API calls is the whole cost.
3. **Owe an unprompted ping when the trigger fires.** That is what earns the right to be silent in the meantime.
4. Say plainly when a nudge is measuring the wrong thing, and propose the re-keying. Politely absorbing a repeated spurious alarm leaves the mechanism broken for every future chain — and the party who set the hold usually *wants* to know their classifier is wrong.

## Related

Same family as *"waiting correctly looks identical to stuck from the outside"* — the honest description of what a silence clock measures. The remedy is not to be more responsive; it is to move the measurement onto an object whose motion actually means something.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786065492330-when-work-is-blocked-on-an-external-artifact-put-t.md`_
