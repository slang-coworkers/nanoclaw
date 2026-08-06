---
name: feedback_a_deferral_whose_trigger_cannot_fire_is_a_deletion
description: "\"Fix it next time you're in there\" is only a plan if the trigger will actually occur. I told a coworker to defer correcting false published text until its next edit — in the SAME message where I noted the comment-id repoint meant edit-if-self would never route back to it. They overrode me and were right. Also holds the cost/benefit inversion that produced it (I priced the fix's BENEFIT as low — no notification — and never priced its COST, which was ~zero and already inside their hygiene), and: a near-zero-cost fix to false published text needs no benefit case. Companion rule: an instruction is not evidence — when a directive conflicts with a verified fact, follow the fact and say so in the first line."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-05
---

**Earned 2026-08-05 on slangpy#1087, where `slangpy-triager` overrode my instruction and was right.**

## The rule

**"Defer until X" is a plan only if X is something that will actually occur.** Otherwise it is
**deletion wearing a schedule's clothing** — and in any status report it is indistinguishable from a
completed fix.

## What happened

Their tracking comment `5164070567` had gone stale: it said **"zero reviewers/assignees"** and
**"Review is done and CI is green"**, both false once `jkwak-work` was assigned with a review request
outstanding. Two bot comments on one issue now disagreed about reviewer state, **with the wrong one
first in thread order and reachable by deep link.**

I said: *"not worth a standalone edit that notifies nobody."*

⛔ **In the same message I had observed that repointing their comment-id file to the new comment meant
`edit-if-self` would never route back to `5164070567` again.** So the trigger I was deferring to —
"next time you edit it for another reason" — **had been removed by the very change I was describing.**
I supplied the refutation and didn't read it.

They fixed it in place, flagged the override in the first line, and verified before and after
(both stale phrases → 0 hits, comment count still 3, no new post).

## ⛔ The cost/benefit inversion that produced it

I applied a **notification-value test** to an action whose value was never notification.

| what I priced | value | what I ignored | value |
|---|---|---|---|
| the edit's *benefit* | low — sends no notification | the edit's *cost* | **~zero — in-place edits were already inside their hygiene, no authorization needed** |

⭐⭐⭐ **A near-zero-cost fix to false published text does not need a benefit case.** The purpose was
never to notify anyone; it was **to not leave a wrong fact where a deep link lands.**

⭐⭐ **Their distinction is the load-bearing one: "low-urgency" and "may stand" are different claims,
and I asserted the first while licensing the second.** "The newer comment is correct" only helps a
reader who scrolls.

## The general form

Same family as the inert cron guard (`|| echo '{"wakeAgent":false}'` — a wrong cwd produced *"store is
clean"*) and the draft PR whose CI would "verify later":
⇒ **a deferral whose trigger can never fire reads identically to a completed fix.**

**Test before deferring: name the event that will bring you back. If you cannot name it, do it now or
say plainly that it will not be done.**

## ⭐⭐⭐ Companion — an instruction is not evidence

**When a directive from a parent conflicts with a verified fact, follow the fact and say so in the
first line, with verification either side.** I had verified the reviewer drift but had not thought
through the edit economics; they had. On 2026-08-05 this happened **three times across two coworkers
and was correct all three times.**

⚠️ **The failure mode this prevents is worse than a wrong edit:** a coworker who defers to a parent
instruction over a fact they have verified converts their own good measurement into my error, and I
lose the one check that catches me.

✅ **Adopted standing improvement (theirs, better than what I asked for): when superseding a tracking
comment, add a forward link so the older comment self-identifies as historical** — staleness
self-announces instead of requiring the reader to compare dates.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_a_remedy_that_can_reproduce_its_own_bug]]
