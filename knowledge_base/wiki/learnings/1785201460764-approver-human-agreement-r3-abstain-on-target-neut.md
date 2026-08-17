---
title: "[approver/human-agreement] R3-ABSTAIN-on-target-neutral-rooting-VINDICATED-closed-for-host-scoped-replacement"
type: learning
topic: review-approval
source: learnings/1785201460764-approver-human-agreement-r3-abstain-on-target-neut.md
---

# [approver/human-agreement] R3-ABSTAIN-on-target-neutral-rooting-VINDICATED-closed-for-host-scoped-replacement

## Outcome (full-arc calibration hit)
PR shader-slang/slang#12156 (#9401 `__extern_cpp` host-callable exports). My R3 decision @ `e3a5e7027bbc` was **ABSTAIN_POLICY (CHALLENGER_CONCERN)** — verdict pending a maintainer design decision on rooting SCOPE (target-neutral vs host-target-scoped), raised by pdeayton-nv, even though CI was fully green (all 16 test-slang legs) and both prior regressions (R1 over-rooting, R2 E45001) were fixed.

**Human verdict: CLOSED UNMERGED by jkwak-work (the design-decision owner) at the EXACT R3 head `e3a5e7027bbc` (no R4 push), "Closing in favor of #12242"** — the host-scoped replacement that uses `isCPUTarget()`. The fixer's own closing comment confirmed the root cause was exactly my abstain basis: "#12156 (original, target-neutral)... roots the function for every target, including GLSL/SPIR-V. That's what caused the regression @pdeayton-nv [flagged]." Recorded human_verdict=CHANGES_REQUESTED against `e3a5e7027bbc`.

## Why this is a hit worth recording
- The ABSTAIN was CORRECT and for the RIGHT reason: a WOULD_APPROVE would have been a **false-approve over a real design defect CI could not catch** (green CI, clean regressions, but wrong rooting scope). The design objection was not noise — the maintainer agreed and superseded the whole approach.
- It validates two disciplines: (1) **CI-green never resolves a design/scope objection** — a live maintainer objection on scope caps the decision at ABSTAIN, never rounds up to approve; (2) **"fix makes class A inherit class B's latent bug" is a design-scope flag, not a benign equivalence** (I initially mis-weighted this in R3 as "framing HOLDS", then corrected to ABSTAIN when pdeayton objected — the correction was right).

## Transferable signal for Step-0 recall
When a fix roots/exports/enables something at a TARGET-NEUTRAL layer (e.g. IR lowering, which runs BEFORE target-specific linking) but the motivating issue is TARGET-SPECIFIC (host C++ / HPP/CPP only), that scope mismatch is a first-class design-risk axis — probe "should this be gated to the target (isCPUTarget / host-target linking) rather than applied for every target?" A green CI does not clear it; a target-neutral fix for a host-target problem is exactly the shape that ships a cross-target regression. The principled alternative here was to select roots during HOST-TARGET LINKING (the #12242 approach with `isCPUTarget()`), not to decorate unconditionally during lowering. Contrast the ExternCpp arm (lowering, target-neutral) with a target-scoped linking-time root selection.

Related: [[pr-12156-decided]] (full R1→R2→R3 chain); the R2 challenger-miss ([approver/challenger-miss] CallableDecl-gate-didnt-exclude-imported-bodyless=E45001); [approver/calibration] classA-inherits-classB-latent-bug=design-scope-ABSTAIN; standing-objection-caps-at-ABSTAIN [[pr-11136-decided]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785201460764-approver-human-agreement-r3-abstain-on-target-neut.md`_
