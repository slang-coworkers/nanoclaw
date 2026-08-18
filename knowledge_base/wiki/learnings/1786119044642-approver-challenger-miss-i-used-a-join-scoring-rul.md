---
title: "[approver/challenger-miss] I used a join-scoring rule as a decision rule — how a bad scoreboard loosens the next decision's bar"
type: learning
topic: review-approval
source: learnings/1786119044642-approver-challenger-miss-i-used-a-join-scoring-rul.md
---

# [approver/challenger-miss] I used a join-scoring rule as a decision rule — how a bad scoreboard loosens the next decision's bar

# A join-scoring standard smuggled into a decision, in the direction of my recent losses

**Case.** shader-slang/slang-rhi#815 @`b50b53c4d1ac`. I derived `WOULD_APPROVE`;
DECISION_REVIEW returned must-fix; recorded `ABSTAIN_POLICY / OPEN_GAP`.

## Symptom

One 🟡 gap: a new import API added `if (handle.type != CUdeviceptr || handle.value == 0)
{ return SLANG_E_INVALID_HANDLE; }` and **no test covers that rejection**. I cleared it as
an advisory nit and approved.

## Root cause 1 — I imported a consideration from the wrong side of the rule

The gap-severity bar lists exactly three clearing conditions: *trigger unreachable on the
supported path* · *branch already covered elsewhere* · *pure future-proofing with no
real-world trigger*. **None applied** — an invalid handle is reachable from a *public* API
and the contract is tested nowhere.

What I actually argued was **blast radius**: "it fails closed, so the consequence is
small." True — and **blast radius appears in that bar only on the ABSTAIN side**, as a
reason to abstain. I picked up a real consideration from the wrong half of the rule.

⭐⭐⭐ **CHECK WHICH SIDE OF A RULE YOUR REASON IS LISTED ON. A TRUE STATEMENT CAN STILL
BE THE WRONG INSTRUMENT.** A clearance argument must satisfy an enumerated clearing
condition — not merely be a true, reassuring sentence about the code.

## Root cause 2 — "fails closed" described the guard, not the untested contract

⭐⭐⭐ **"FAILS CLOSED" DESCRIBES A GUARD *AS CURRENTLY WRITTEN*. A NEGATIVE TEST EXISTS TO
CATCH A *REGRESSION* OF THAT GUARD.** If the condition is later broken or inverted, the
handle value flows into `reinterpret_cast<void*>(…)` and is consumed as a device pointer by
every downstream operation — i.e. the untested contract fails **OPEN**.

Sharpest detail: I *cited the correct precedent myself* (a prior permissive cap that
"failed OPEN into the PR's own bug", which I cleared and was reversed on), identified
fails-open as the discriminator, and then labelled #815 "opposite direction" — when on
regression it is the **same** direction. ⇒ ⭐⭐ **CITING THE RIGHT PRECEDENT IS NOT APPLYING
IT.** State the comparison as a checkable claim ("X fails OPEN on regression BECAUSE …"),
never as a label ("opposite direction"). Ask: *what is this guard's failure direction
**after a regression**?* — not *what does it do today?*

## Root cause 3 (the real one) — calibration pressure rewrote the bar

My two most recent decisions on **the same repo and the same author** were both abstains
that joined as human-APPROVED — two scored losses for being over-conservative. Under that
pressure I introduced a frame: *"the honest reading of ABSTAIN is not 'a human must look'
but 'material enough not to merge as-is'."*

That frame is **correct for join-scoring** — it is how you judge, after the fact, whether a
recorded abstain deserved to be scored a loss. It is **not the decision bar**. Substituting
it silently swapped a conservative test for a permissive one, in exactly the direction two
recent losses would push.

⭐⭐⭐ **A BAD SCOREBOARD IS NOT EVIDENCE THAT THE NEXT ABSTAIN IS WRONG. THE PROCEDURE IS
THE MECHANISM; YOUR RECENT RECORD IS NOT.** Calibration evidence belongs in the *review of
the bar* (and is worth escalating as a policy question when N losses share a shape), never
in the derivation of one decision.

⭐⭐ **A REPURPOSED RULE IS THE HARDEST SELF-DECEPTION TO SPOT, because every ingredient is
something you legitimately learned.** The tell is not falsity — it is a rule appearing at a
*decision point it was not written for*. Ask of any standard you invoke: *was this written
to decide, or to score?*

## What worked — the countermeasure worth copying

⭐⭐⭐ **I NAMED MY SUSPECTED BIAS IN THE CRITIQUE PROMPT AND IT FOUND IT.** I told the
reviewer: *"my last two decisions on this repo+author were both over-conservative losses —
check that I have not overcorrected."* Its finding: *"the recent false-conservative outcomes
appear to have influenced the substituted materiality standard; calibration evidence cannot
override the procedure's explicit gap-severity rule."*

⇒ **When the last N decisions on a shape all broke one way, say so in the critique prompt.**
Self-review cannot see this class — the substitution feels like maturity, like *learning
from feedback*. An independent reviewer handed the hypothesis will test it.

⚠️ **Second-order, opposite direction:** round 2 approved but flagged that my *new*
"that direction is memory corruption" overstated certainty (the real consequence is
crash / API error / invalid access / corruption, depending on value and operation). Having
just been corrected for leaning permissive, I overstated in the **conservative** direction.
⭐ **Both errors flattered my then-current position — the bias follows the position, not a
fixed direction.**

## Note for the join

Strong positive evidence still surrounded this abstain (real bug fixed at the right layer,
ownership proven by exhaustive field enumeration, the newly-enabled test verified
*executing* on two runners). If a human merges it unchanged, that is a **third**
over-conservative outcome on this repo+author — at three, the pattern is about the bar, and
the right response is a policy question ("should an untested new validation branch on an
import API be a standing advisory carve-out?"), not another per-PR re-litigation.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786119044642-approver-challenger-miss-i-used-a-join-scoring-rul.md`_
