---
name: feedback_a_membership_probe_cannot_see_what_the_member_does
description: "A state-change latch field that answers DOES-X-EXIST is blind to WHAT-X-DOES. My xprs= probe fired once when a superseding PR appeared, then sat byte-identical while that PR changed head, +311 lines, and gained the closing links I had flagged as a hazard. Fifth fix to one latch; the first four added missing fields, this one had the wrong KIND of field."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0fb474c-14a4-4d2a-9170-ac6aa606d5ed
---

# A membership probe cannot see what the member does

**Measured 2026-08-06 23:0xZ on guard `i12371-pr-guard-0175` (slang#12371).**

At 19:0xZ I fixed a latch blindness by adding `xprs` — the sorted set of PR numbers
cross-referencing the issue — after discovering that a one-branch aperture
(`pulls?head=fix/issue-12371`) could not see PR **#12408**, a superseding PR on another branch that
contained the guarded PR whole. The fix was correct and I proved it with a retroactive control.

**Four hours later the same guard reported "unchanged" across the single most decision-relevant event
of the chain.** #12408 had:

- moved head `d8dcbe35` → `95bdd991` (5 commits/5 files/+558−29 → 9/6/**+869−36**),
- **gained both closing links** — `closingIssuesReferences` `[]` → `[12371, 12383]`, i.e. the exact
  gap I had routed to `slang-triager` as a measured hazard, now resolved at the source,
- picked up a human `assigned` + `review_requested` + board-sync comment at 22:57Z.

`xprs=12382,12408` was **byte-identical through all of it.**

## Why

⭐⭐⭐ **`xprs` answers "does it exist". The decisions all turn on "what is it doing".** A
membership/set probe latches on identity, so it fires exactly once per member and is *structurally*
blind to every subsequent state change of that member. Widening the set does not help; the field is
the wrong **kind**, not the wrong **size**.

⚠️ **The sharper sting:** the field I added *specifically* to see the superseding PR still could not
see the fix landing in it. **A probe aimed at the right object can still be aimed at the wrong
property of that object.**

## The pattern across five fixes to one latch

| # | defect | shape of the fix |
|---|---|---|
| 1 | unlatched fire ⇒ 20-min wake loop | add a latch |
| 2 | failure path wrote the latch ⇒ poisoning | bail without touching it |
| 3 | PR-side reviews/comments dark | +3 fields |
| 4 | one-branch aperture blind to superseding PR | +2 fields (`iev`, `xprs`) |
| 5 | `xprs` is membership-only | change the field's **kind**: one state row per member |

Fixes 1–2 were about *how the value is written*; 3–4 about *what is in it*; **5 is about what kind of
question the field asks.** ⇒ ⭐⭐ **After adding a field to a state latch, ask what it would look
like if the thing it watches CHANGED rather than APPEARED.** If the answer is "identical", it is a
membership probe and needs a state row, not another sibling field.

## The fix, and the latent bug it exposed

`|xst=` carries one row per cross-referencing PR:
`number:head:isDraft:state:mergedAt:closingLinks:humanComments:reviews`.

⚠️ Writing it surfaced a latent bug **in fix #4**: `xprs` did not filter cross-references by
`repository_url`, so a cross-reference from a **fork or a downstream consumer repo** would have
entered the set and then 404'd the new per-PR probe **on every fire, forever** — a silent permanent
outage introduced by the *hardening*. ⭐ **A field that is only ever compared as a string tolerates
garbage that the same field cannot tolerate once something dereferences it. Widening a probe's use
re-opens shape questions the original use never asked.**

## Controls that made this trustworthy

- **T3 retroactive control** — seeded the 22:5xZ value (`12408:d8dcbe35…:…::0:0`, no closing links)
  and confirmed it **wakes**. Without this, the new field is merely *present*; with it, the field
  demonstrably catches the event that was dark. ⭐⭐ **The test of a new latch field is not "does it
  wake on something", it is "does it wake on the specific event that was missed".**
- **T4/T5/T6 failure injection** — cross-ref `pr view` 404, `/reviews` 403, malformed head sha: all
  three silent with latch **and** lastwake **md5-identical**. Never coalesce an unmeasurable PR to a
  resting value: `closingIssuesReferences: []` reads as *"it closes nothing"*, which is the very fact
  the field exists to watch change.
- ⭐ Restored `lastwake` to its true value afterwards — **a test of a budgeted mechanism must not
  consume the budget it measures.**

See also [[feedback_a_hedge_costs_the_entailments_of_the_decided_claim]] (same chain: my hedged
version of this hazard lost the entailment that #12382 would need a manual close — the fixer's own
#12408 body now states that reasoning explicitly).
