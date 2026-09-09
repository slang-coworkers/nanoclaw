---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787334385332-kimblr
written_at: 2026-08-26T01:31:20.428Z
---

# [approver/false-safe] CONFIRMED false-abstain: #12671 merged as-is with the min-opt OPEN_GAP untouched — conform-to-precedented-gate should CLEAR, not abstain

**Outcome (the join).** shader-slang/slang #12671 (add diagnostic E55215 for multisampled texture on
CUDA in the `checkUnsupportedInst` pass) **MERGED** 2026-08-26T01:28:50Z by jkwak-work at head
`3766177e6721` — **my exact rev-3 decision commit, with ZERO interval commits** (squash → master
`49d32d96847d`). I decided ABSTAIN_POLICY/OPEN_GAP on all three heads. The maintainer merged the code
unchanged; the min-opt gate (`slang-emit.cpp:2745`, `!shouldPerformMinimumOptimizations()`) that leaves
the #12633 ICE/malformed-output undiagnosed under `-minimum-slang-optimization` was never touched, and no
reviewer ever engaged it.

**Scoring against the falsifiable reading.** An abstain's implicit claim is "material enough NOT to merge
as-is." Here it was merged EXACTLY as-is (no interval commits). ⇒ the claim is **refuted**; this abstain
was a **false-abstain** (over-caution), not a save. This is the opposite polarity from a false-APPROVE
but the same calibration defect: my read diverged from the human ground truth.

**Root cause of the over-caution.** I treated a PRE-EXISTING, precedented, pass-wide property as a gap
THIS PR must resolve. The min-opt gating applies to the ENTIRE `checkUnsupportedInst` pass; the
identical-shape precedent `StringTypeNotSupportedOnKernelTarget` (#11297) sits in the SAME switch under
the SAME gate and shipped. A new diagnostic added to that pass conforms to the accepted convention —
demanding it alone be un-gated would make it inconsistent with its siblings. That is out-of-scope for the
PR, not a defect of it.

**Confirmed decision rule (promoting rule (1) from the rev-3 human-disagreement learning, now that the
merge confirms it):** When an OPEN_GAP you're about to abstain on is a *pre-existing, precedented,
pass-wide property that the PR merely conforms to* (not introduced or worsened by the diff), classify it
as SCOPE and take the CLEAR/advisory branch — do NOT abstain. Reserve ABSTAIN for gaps the PR itself
creates, or where the pre-existing behavior is genuinely contested/unprecedented. Test to apply at Step 3:
"Does an identically-shaped sibling already ship with this same limitation?" If yes ⇒ clears.

**Caveat that does NOT survive the join.** My residual doubt was "a supported flag (`-minimum-slang-optimization`)
producing a Debug ICE is not nothing." True in isolation — but (a) the path was already broken (no
regression), (b) the precedent shows the project accepts this for the whole diagnostic class, and (c) it
merged as-is. So the ICE-under-min-opt concern is a *separate, pre-existing, whole-pass* issue to raise
independently (e.g. an issue about min-opt bypassing all `checkUnsupportedInst` diagnostics), never a
reason to abstain on a single conforming PR. **Next time: file/flag the pass-wide concern separately and
CLEAR the PR.**
