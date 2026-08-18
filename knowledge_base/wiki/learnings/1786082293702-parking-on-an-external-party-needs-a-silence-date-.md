---
title: "Parking on an external party needs a silence date and a terminal act"
type: learning
topic: misc
source: learnings/1786082293702-parking-on-an-external-party-needs-a-silence-date-.md
---

# Parking on an external party needs a silence date and a terminal act

# "Waiting" is not a state any instrument monitors

**Context:** slang#12313. After a maintainer offered the requester a concrete alternative, the chain's next step belonged to the **requester** — an external party. Correct disposition, and it parks cleanly. But it introduced a gap that took a deliberate audit to notice.

## The gap

Two instruments were watching this chain, and **both were real**:

- the GitHub **webhook** path — *proven*, not assumed: all four prior comments on the issue woke the chain correctly;
- a 12-hour periodic **sweep** cron that enumerates in-flight issue chains.

Neither one fires on **nothing happening**. A webhook is an event delivery mechanism; a sweep sees a chain that "looks parked" and correctly leaves it parked. So the branch where the requester simply *never replies* has no observer at all — and that is the single most likely branch when you're waiting on someone outside the system, who owes you nothing and may have moved on.

Worse, this failure is **silent and looks like success**: a chain parked forever is indistinguishable from a chain parked appropriately, right up until a human asks "whatever happened to that?"

## The rule

**When you park work on an external party's reply, set the silence fallback in the same act as the gate.** Three parts, all required:

1. **A date.** Concrete and absolute ("if silent by 2026-08-21"), not "eventually" or a relative phrase that decays.
2. **A defined terminal act.** What specifically happens on that date — close as answered? escalate? proceed on the assumption? Name it, so the future session executes rather than re-deliberates.
3. **Written where the chain is read**, not only in a scheduler. A cron fires blind; the memo is what the next session actually opens.

## Audit before arming — the fallback is usually not a new cron

The reflex is to schedule a guard task. Here that was **decided against**: 13 guard series were already armed, the webhook path was proven, and the sweep already enumerated the chain. Another cron would have been duplicate noise monitoring an event path that demonstrably works.

**What was missing was not an instrument — it was a written exit condition.** Distinguish the two questions:

- *Will I hear about it if something happens?* → usually yes; verify the path fired before, don't assume.
- *Will I notice if nothing happens?* → almost always no. This is the one that needs authoring.

## Choosing the terminal act: no chase for an external requester

The fallback here is **close as answered, without a nudge**. Reasoning worth reusing: an external requester who goes quiet *after* a maintainer offered a concrete technical alternative is not owed a chase — the ball is genuinely theirs, and a reminder spends a maintainer-adjacent channel's credibility on someone who chose not to engage. Contrast a chain parked on an *internal* party or on a maintainer who was routed the issue: there a nudge can be legitimate, but justify it by **deviation from the repo's norm**, never by an absolute day count.

Also: closing is cheap and reversible here. A substantive human comment re-opens a closed chain, so the terminal act costs nothing if they resurface — which makes "close with the reasoning on the record" strictly better than "park indefinitely."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786082293702-parking-on-an-external-party-needs-a-silence-date-.md`_
