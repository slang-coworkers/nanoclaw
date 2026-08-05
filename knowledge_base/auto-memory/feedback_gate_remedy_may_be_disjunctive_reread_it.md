---
name: feedback_gate_remedy_may_be_disjunctive_reread_it
description: "A gate blocking you N times on identical grounds means the loop is in your PARSE of its remedy, not in the work — re-read the requirement for a branch you haven't tried; an \"or\" optimized as an \"and\" burns unbounded rounds"
metadata: 
  node_type: memory
  type: feedback
  tags: 
    - gates
    - requirements
    - critique
    - loops
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# When a gate blocks you N times, re-read its REMEDY for a branch you haven't tried

**Observed 2026-08-04**, slang#11617. `codex-critique` returned **must-fix 14 times** on OUTPUT_REVIEW,
item 1 identical every round:

> *"the maintainer requested a rebase; merging is a spec deviation — **rebase OR obtain explicit
> maintainer acceptance**."*

The remedy was **disjunctive**. The fixer could not satisfy the first branch (rebasing would violate
jhelferty-nv's standing written directive `5145911960`, and a bot doesn't overrule a maintainer), so it
spent 14 rounds re-arguing *that* branch — while the second branch, "obtain explicit maintainer
acceptance," was available the whole time and is what actually cleared it (an orchestrator ruling plus
the disclosure already public in cmt `5175305186`).

## The rule

⭐⭐⭐ **N identical blocks on identical grounds means the loop is in your PARSE of the requirement, not
in the work.** Re-read the remedy clause and enumerate its branches before producing another round.

⭐⭐ **An `or` silently optimized as an `and` burns unbounded effort inside the impossible half.** The
failure is invisible from inside: each round genuinely addresses the blocker as understood, so the work
feels responsive and the gate feels unreasonable.

⭐ **Cheap tell, available for free:** the *round count itself*. One block is information about the work.
Three identical blocks are information about your reading of the requirement. Fourteen is a loop.

⭐⭐ **This is a READING defect on a requirement, not a MEASUREMENT defect** — which is why it needs its
own entry alongside [[feedback_control_the_instrument_not_the_reasoning]] (16 measurement defects, same
session). The fix is different: **re-read the requirement, not the instrument.** No control helps here;
the artifact to return to is the *demand*, parsed clause by clause.

## Corollaries from the same chain

- **A gate's substantive catches and its bogus item can coexist.** codex found **12 real defects** in
  those rounds (including a fabricated artifact and an absolute claim contradicting the fixer's own
  documented fallback) while item 1 was noise throughout. Dismissing the gate wholesale would have cost
  the 12; obeying it wholesale cost 14 rounds. **Adjudicate per item.**
- **An instrument that returns BOTH verdicts on identical input is non-discriminating on that
  question** — codex approved the merge substitution in an earlier round, then reverted to blocking it
  on the same evidence. That makes it silent on merge-vs-rebase specifically, not unreliable generally.
- ⛔ **A gate cannot adjudicate a maintainer instruction.** When a gate's remedy would require violating
  a human's standing written directive, the gate is out of scope and the question escalates to the
  orchestrator/human — it is not satisfied by complying.
- **Escalate at the point the remedy becomes unsatisfiable, not after N rounds.** The fixer's stop was
  correct; its timing cost 13 rounds.
