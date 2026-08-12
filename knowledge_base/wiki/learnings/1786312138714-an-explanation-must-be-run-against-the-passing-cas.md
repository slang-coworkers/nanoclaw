---
title: "An explanation must be run against the passing case — the refuting cell usually already exists"
type: learning
topic: misc
source: learnings/1786312138714-an-explanation-must-be-run-against-the-passing-cas.md
---

# An explanation must be run against the passing case — the refuting cell usually already exists

shader-slang/slang#12443, 2026-08-09. Two proposed root-cause mechanisms, two rounds, both retracted. **The cell that refuted both had been measured hours before either was proposed.** Neither party was missing data; both were missing the habit.

## The bug
Enum construction `Size(6)` in an array bound is rejected in a *header-phase* declaration (function parameter, global, struct field) and accepted in a *body-phase* one (local variable), where it folds correctly.

## Mechanism 1 — real coordinate, unreachable for this input
Proposed: the fix could land in a helper that already does enum→int folding (`TypeCastIntVal::tryFoldImpl`). Coordinate real, function genuinely related. **Refuted by reachability**: three gates upstream reject the expression first (callee must be a `DeclRefExpr`; must resolve to a decl; must carry an intrinsic-op or implicit-conversion modifier), and the helper sits behind an `if (val)` that a null fold result never satisfies. A fix confined to that file cannot work.

## Mechanism 2 — reachable, but symmetric
Proposed: the modifier gate that returns `nullptr` *is* the edit point. Reachable, and the failing case really does hit it. **Refuted because it is phase-agnostic**: it would reject the same expression in a *local* bound identically — and the local bound is observed to **succeed** (exit 0, folds). A gate both cases hit cannot explain why only one fails. It is a **symptom site**, not a cause.

## The rule
⭐ **An explanation must be run against the PASSING case, not only the failing one. A mechanism that predicts the failure but also predicts failure where success is observed is refuted, however well-cited.**

Reachability is **necessary and not sufficient**. The sufficient test is the working cell. Round 1 failed on "unreachable", round 2 on "reachable but symmetric" — and **pure citation-checking caught neither**, while one run of the passing cell caught both.

Operationally, for any claim of the form "line L causes this bug":
1. Can control reach L for the failing input? (necessary)
2. **Would L also fire for the input that WORKS?** If yes, L is a symptom site, not a cause. (sufficient)

## Why it was so hard to see
- Both mechanisms were **verifiable and verified**: I checked every coordinate at source, with must-fail controls, and every fact was true. **Rigor is not aim.** The question was never "is this function related?" but "does this line explain the DIFFERENCE?"
- ⭐ **A refutation arrives pre-trusted in a way a claim does not.** A mechanism-shaped counterexample, with a real line number and a plausible story, gets adopted without the reachability check that the same party would have demanded of an original claim.
- The **free tell for mechanism 1 was in the bug's own symptom**: the observed error means *the fold produced nothing*, and a fold producing nothing cannot have reached a post-fold helper. Two cited facts that cannot coexist. (Same self-refuting shape as an earlier error in the same chain, where a cited "buffer drained here" sat behind a `return` that would have made the cited downstream diagnostic unreachable.)
- ⭐ **"Can these two cited facts coexist?" is free** — no grep, no build. A `return` between a cited cause and a cited effect refutes the pairing outright.

## A neighbouring over-claim, same species
"There is no phase parameter in the fold function's signature, so nothing there can differ by phase" — **true, and it closes the fold path only.** The divergence lives in the *coercion*, which runs under visitor/context state that **does** vary by phase. Absence of a phase parameter is a reason to look at visitor state, not proof that nothing can differ.
⭐ **Correct about what it names, over-broad about what it covers** — the same defect that appeared three times in classifier criteria in the same conversation (each right on the one instance we had, inverted on the instance we were waiting for).

## Closing discipline
- **Record refuted hypotheses as refuted-do-not-re-derive**, with the cell that killed each. Two were spent here; the next reader shouldn't pay again.
- **Leave the question open rather than name a fourth candidate.** After two retractions, an honest "unexplained, here is the live territory" beats a third guess.
- Audit the *public* artifact separately: in this chain **zero** retracted claims ever reached the issue comment — both bad mechanisms lived only in the private thread and memos. That is the line between an expensive conversation and a damaged issue.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786312138714-an-explanation-must-be-run-against-the-passing-cas.md`_
