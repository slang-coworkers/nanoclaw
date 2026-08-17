---
title: "[approver/calibration] fix-making-classA-inherit-classB-latent-bug-is-design-scope-ABSTAIN-not-benign-equivalence"
type: learning
topic: review-approval
source: learnings/1784665766341-approver-calibration-fix-making-classa-inherit-cla.md
---

# [approver/calibration] fix-making-classA-inherit-classB-latent-bug-is-design-scope-ABSTAIN-not-benign-equivalence

## Symptom
On PR shader-slang/slang#12156 R3, my challenger established a FACT: post-fix a local `public __extern_cpp` function and an `export __extern_cpp` function converge to the same export-relevant decoration set (ExternCpp+HLSLExport+KeepAlive), so `public __extern_cpp` now inherits whatever GLSL behavior `export __extern_cpp` already exhibits (incl a latent `main`-collision quirk). I judged this benign — "intended public≡export unification inheriting a pre-existing, acceptable quirk" — and had the framing as "(a) HOLDS", leaning WOULD_APPROVE. A maintainer (pdeayton-nv) then objected on DESIGN: the quirk should NOT be inherited, and the rooting is over-broad — TARGET-NEUTRAL (roots for every target incl GLSL/SPIR-V) when the issue (#9401) needs only HOST-target (HPP/CPP) roots. He proposed a host-target-scoped alternative. CI was fully green (all 16 test-slang legs) — green did not and could not answer this.

## Root cause of the mis-weight
I correctly derived the decoration-set convergence but conflated two different questions: (1) "is the equivalence a FACT?" (yes, verifiable) and (2) "is inheriting class B's latent bug ACCEPTABLE?" (a DESIGN decision, outside my authority to clear). Calling an inherited latent-bug "a pre-existing quirk, so benign" silently answered (2) with an approve. When a fix makes previously-valid input class A behave identically to a class B that carries a KNOWN-LATENT bug, "A now inherits B's bug" is a scope/design flag to SURFACE, not a benign equivalence to clear — because whether the blast radius (which inputs, which targets) is acceptable is a maintainer call.

## How to catch it
Add to the challenger's checklist: whenever a change makes input-class A acquire the behavior/decorations of class B, explicitly ask "does B carry any known-latent bug or quirk that A now inherits? Is the SCOPE of the new behavior (which targets? which inputs?) wider than the issue requires?" If yes and it's not obviously correct → CHALLENGER_CONCERN → ABSTAIN_POLICY, verdict pending maintainer design decision. Never round WOULD_APPROVE over it just because CI is green: CI green satisfies the behavioral/regression hinge, NOT a design/scope question. A live maintainer objection on scope caps the decision at ABSTAIN (cf standing-CHANGES_REQUESTED precedent) — it is neither approvable (design open) nor BLOCK (no verified 🔴; green CI).

## Fix
Recorded ABSTAIN_POLICY:CHALLENGER_CONCERN. The correct enum framing: fully-green CI + fixed regressions is NOT sufficient for WOULD_APPROVE when a maintainer disputes the design scope; and a design/scope disagreement is NOT a BLOCK (no verified defect). Distinguish "is it a fact" from "is it acceptable" — the latter, when contested by a maintainer, is theirs to decide.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784665766341-approver-calibration-fix-making-classa-inherit-cla.md`_
