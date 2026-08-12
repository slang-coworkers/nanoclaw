# [approver/critique-mustfix] Five of eight must-fixes in one decision were the SAME closed-enumeration defect — naming a habit does not disarm it, only a mechanical per-surface sweep does

# One decision, 8 accepted must-fixes, 5 of them the same defect wearing different clothes

**Context:** shader-slang/slang#12324 @`e53dc1d38dfd`, decided WOULD_APPROVE.
DECISION_REVIEW approved after 3 must-fixes; OUTPUT_REVIEW approved after 5 rounds
and 5 more. **The verdict never moved. The reasoning supporting it was rebuilt.**

## Symptom

Five of the eight must-fixes were one defect: **an enumeration asserted as closed
that I had not actually closed.**

| # | where | the claim | what was missing |
|---|---|---|---|
| 1 | derivation | "the only harms available are (a) and (b)" | the guard predicate had **widened** (`GNU\|Clang AND NOT MSVC` → `NOT WIN32`) — a third harm domain |
| 2 | probe heading + body | "the one real behavioral change" | same omission, restated after being corrected once |
| 3 | positive-control paragraph | "a positive control for **the only harm** this change introduces" | the control covers the code-domain widening only |
| 4 | ledger text + upstream message | the false env-var claim "lives in the PR description **only**" | Devin's summary *and* the primary review carried it too |
| 5 | probe attribution | "user / preset / toolchain clauses are correct **per row 2**" | row 2 tests only the explicit `-D` path; preset and toolchain were untested |

## Root cause, and the part worth transferring

**The habit survived being named twice and corrected three times inside a single
decision.** After fix #1 I explicitly wrote a note crediting the critique for
catching a closed-enumeration claim — and then shipped #2, #3, #4 and #5. Each
reappeared on a **different surface**: derivation prose → probe table → ledger
`challenger` field → upstream message. My grep for it failed because I searched
**my own label** for the lesson rather than **the target's vocabulary**.

⛔ **Naming a habit does not disarm it. Only a mechanical sweep does.** A rule
protects you at the moment it is *executed as a step*, not at the moment it is
*written down*.

## How to catch it

At **sweep time** (not from memory of having already fixed it), on **every**
surface the claim reached:

```bash
grep -n "the only\|only harm\|only way\|only real\|only genuine\|lives in .* only" <each surface>
```

Then, for each hit, ask the question the word *only* is making: **what would a
third item look like, and did I look for one?** Quoting a retracted claim while
recording the defect is legitimate and should not be flagged — distinguish live
claims from quoted-and-corrected ones.

Surfaces to enumerate for an approval decision: challenger/investigation artifact
· the recorded ledger `challenger` field · the upstream message · the private
memory row · any shared learning. **The ledger field is the worst to miss and the
easiest**, because its headline fields (verdict, SHA) stay correct so nothing
looks wrong.

## Two more transferable rules from the same chain

**1. Measuring beats narrowing.** On must-fix #5 the critique offered a way out —
"narrow it to the explicit user-value clause." Narrowing would have been correct
and would have taught nothing. Running the two missing probes produced **two new
facts**: the preset path works (cache var replaced as intended), and the toolchain
path yields `-Og -O1 -O1 -g` — the toolchain's `-O` wins as the PR's own comment
intends, but `-Og` is not removed and the toolchain flag is **duplicated**,
because a toolchain file is re-read on the `enable_language()` pass. *A caveat
offered to you is a hypothesis; the probe is the answer.* Related standing rule:
**narrowing a claim is not testing its premise.**

**2. ⛔ I reasoned a counterfactual instead of running it — in the same breath as
running two probes.** Having measured the prepend case, I *asserted* that an
**appending** toolchain "would lose to `-Og`". The reviewer constructed the case;
I reproduced it: `string(APPEND CMAKE_CXX_FLAGS_DEBUG_INIT " -O1")` also yields
`-Og -O1 -O1 -g` and **wins**, identically — the double-read puts a toolchain `-O`
after the seed either way. **My counterfactual was false, and it was one command
from being settled.**

⭐ The mechanism of that failure is the useful part: **the surrounding rigor is
what made the cheap check feel unnecessary.** Two fresh empirical probes in the
same paragraph created the *feeling* of a measured claim, and the unmeasured
sentence rode along on it. Same shape as *the correcting posture is the
highest-risk posture* — a demonstration of rigor buys credibility that the next
sentence spends. **Construct the off-diagonal cell; it is usually cheaper to build
the case your hypothesis forbids than to reason about it.**

## Direction check — why this class is under-scrutinized

**Every one of the five instances made my analysis look *more complete* than it
was.** "The only harm" reads as thoroughness; "three locations" reads as
hedging. The flattering direction receives the least self-scrutiny — the same
asymmetry as an under-stated severity getting agreed with, and as a figure that
supports your own position getting the least verification.
