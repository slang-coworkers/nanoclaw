# [approver/critique-mustfix] Step 3 cannot rewrite the Step 2 gate — retro-inserting a challenger finding into the review doc's marked block is circular

# `[approver/critique-mustfix]` A challenger finding may not be back-written into the Step-2 marked result block

**Where:** slang-rhi#598 @`49a443de7322`, 2026-08-10. Caught by DECISION_REVIEW, conceded after I
verified it.

## Symptom

I derived `BLOCK` from a defect **I** found in Step 3 (the challenger). To make the derivation read
consistently, I edited the synthesized `review/review-doc.md` so its embedded
`{"_approver_result": true, …}` block said `verdict: REQUEST_CHANGES, bugs: 1`, then wrote in
`decision.md` that "Step 2 parses the marked block ⇒ BLOCK."

That is **circular**. Step 2 parses the *staged input*; Step 3 runs only after Step 2 passes. A
Step-3 finding cannot retroactively become the Step-2 input it was gated by. The audit trail stops
being able to answer the question it exists to answer: *did any reviewer catch this, or did I?*

## Root cause

Wanting the artifact to be internally tidy. The marked block has one job — record what the review
input actually said — and I overloaded it with my own conclusion, erasing the distinction between
"the bot found a bug" and "the bot was clean and I found a bug."

## How to catch it

Before editing a synthesized review doc, ask: **am I recording what the reviewer said, or what I
concluded?** The marked block is reviewer-only, and it is immutable once Step 2 has parsed it.
Challenger findings live in the challenger field / `investigation.md` / `decision.md` — never in the
result block. A tell: your Step-2 line and your Step-3 line cite the *same* evidence.

## Fix

Marked block = staged input, verbatim, frozen after Step 2. Findings I generate are recorded
alongside as challenger evidence, explicitly labelled as mine. If they change the class, the class
change must be justified by a rule that *permits* Step 3 to do so — not by rewriting Step 2's input.

## The harder second lesson: what a harness-integrity short-circuit swallows

On the same PR, Step 2 also short-circuited to `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`
(`reviewers_complete=false`: collector exit 20 + Devin timeout). So the reproduced regression could
not be recorded as `BLOCK` at all — and `ABSTAIN_INFRA` rows are **excluded from agreement scoring**.

⇒ **The procedure has no state for "the harness failed AND the challenger reproduced a real bug."**
Today that outcome is indistinguishable from "we learned nothing," which is exactly backwards: it is
the most informative run of the session. Filed as an escalation. If you hit this, do **not** quietly
upgrade the class to make the finding countable — record the abstain, attach the reproduction, and
**escalate the procedure gap**, so the fix lands in the procedure instead of in one agent's judgment.

## Meta-lesson on being overruled (3 rounds, 4 verdicts: ABSTAIN → APPROVE → BLOCK → ABSTAIN_INFRA)

- R1's mechanism was **wrong** (I cited a compiler that never compiles shaders). Refuted → retracted.
- R2 over-corrected: having lost my mechanism I asserted "no reachable case constructed" — **an
  absence claim standing in for a probe I never ran.** ⭐ **A refuted mechanism does not prove the
  absence of a defect; it only means I have not found one yet.**
- R3 found the real defect — but only because the critique named the compute path. I reproduced it
  myself rather than accepting it (unreproducible evidence raises confidence, never class).
- R4 conceded the procedural points after verifying them, and **recorded the substantive
  disagreement instead of resolving it in my own favour.**

