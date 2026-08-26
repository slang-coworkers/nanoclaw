---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787334385332-kimblr
written_at: 2026-08-25T21:13:43.613Z
---

# [approver/human-disagreement] repeated ABSTAIN/OPEN_GAP on a pre-existing pass-wide gate that a MEMBER then approved without engaging it

**Case.** shader-slang/slang #12671 (bot-authored: add diagnostic E55215 for multisampled texture on
CUDA, in the `checkUnsupportedInst` pre-emit pass). I decided ABSTAIN_POLICY/OPEN_GAP on all three
heads (05505db4, 1ee58374, 3766177e). The gap: E55215 is emitted only by `checkUnsupportedInst`, gated
at `slang-emit.cpp:2745` on `!shouldPerformMinimumOptimizations()`, while the CUDA emitter failure it
guards (`_calcCUDATextureTypeName`, `slang-emit-cuda.cpp:246`) is not opt-gated — so under the supported
`-minimum-slang-optimization` flag the #12633 ICE/malformed-output stays reachable and undiagnosed.
Across rev-2→rev-3 the change was purely cosmetic (a rename per a review nit; gate byte-identical), so
the gap never closed. **jkwak-work (MEMBER) then APPROVED at the exact head** — but the review thread
covered only whether CUDA supports MS textures (no) and the naming nit; it never engaged the min-opt
path.

**The tension (the reason this is logged).** A clean human approval at my exact decision head is the
falsifying signal for the abstain's implicit claim ("material enough that a human must look before
merging"). Here a human looked and approved. Two readings, both must be recorded honestly:
1. **My abstain is over-cautious.** The min-opt gating is a PRE-EXISTING, pass-wide property: the
   identical-shape precedent `StringTypeNotSupportedOnKernelTarget` (#11297) sits in the SAME switch
   under the SAME gate and shipped. A new diagnostic conforming to that accepted convention arguably
   inherits its accepted min-opt behavior — demanding THIS one diagnostic be un-gated would make it
   inconsistent with its siblings. Under that framing the gap is out-of-scope for the PR and should
   CLEAR, not abstain.
2. **The human missed it.** The approval never engaged the min-opt path, and the Debug manifestation is
   an ICE (compiler crash) under a supported flag — not nothing. So the approval is not *informed*
   evidence the gap is immaterial.

**How to catch / apply next time.** When an OPEN_GAP you're about to abstain on is a *pre-existing,
precedented, pass-wide property* that the PR merely conforms to (not something the PR introduces or
worsens), weigh it as a SCOPE question, and lean toward CLEAR (advisory) rather than ABSTAIN — the PR
following an accepted convention is not a defect of the PR. Reserve ABSTAIN for gaps the PR itself
creates or where the pre-existing behavior is genuinely contested. Decision-rule refinement:
"conforms to an accepted, identically-gated precedent in the same pass" is strong evidence for the
"clearly inconsequential for this PR's scope" clearance branch. **Caveat / why I still abstained here:**
a supported flag producing a Debug ICE gave me residual doubt, and my standing order forbids rounding
up on a human approval that didn't address the concern — so I held the abstain and logged the
disagreement rather than flip under the approval. If the join scores this as a false-abstain, the
corrective is rule (1) above, applied at decision time, not deference to the human verdict.
