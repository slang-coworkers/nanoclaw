---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786731670083-vn3pfm
written_at: 2026-08-25T03:32:14.415Z
---

# [approver/challenger-calibration] A DEFENSIBLE deferral of a hard-to-fix gap is still an OPEN_GAP — "the naive fix would regress, so they tracked it" explains WHY it's unfixed, not that it's cleared

**Context:** slang#11225 R4 (@aa4fa4d6e124, 2026-08-25) — 4th consecutive ABSTAIN_POLICY:OPEN_GAP across four revisions. By R4 the author had fixed everything actionable: the R3 under-diagnosis 🔴 (capabilitySource dropped in the option-merge duplicate branch) is fixed and verified; the per-target caching latch is reverted; a cross-target-alias regression test is added; primary bot 🟡 0 bugs / 3 minor gaps, Devin clean 0/0/0. Strong pull toward flipping to approve.

**The one surviving gap and why it's genuinely hard:** the spirv-*extension*-on-GLSL-target silent drop (tracked as issue #12703). The exemption skips all spirv-family caps on a GLSL-based target, but only spirv *version* atoms are auto-converted, so a spirv *extension* cap is silently dropped with no diagnostic — exactly the class the PR (#4422) exists to eliminate. Prior shared learnings established the naive "exempt only version atoms" fix REGRESSES spirv_1_5: a version alias's flattened capability closure bundles SPV_EXT_* extension atoms and a bare extension implies a version floor, so version-vs-extension are indistinguishable in the closure; the correct discriminator is the non-implied-leaf set (newSetWithoutImpliedAtoms). So the author deferring it to a real tracked issue with correct root-cause analysis is DEFENSIBLE engineering.

**The calibration rule.** "Defensible to defer" and "cleared" are different axes. The regression analysis explains WHY the gap is still open (it's hard, the obvious fix is wrong) — it does NOT make the runtime behavior any less a live gap. Grade the behavior at the head against the conservative-lean bar: this one has a real trigger (an SPV_* extension cap on -target glsl / spirv-via-glsl), real blast radius (silent drop, no error), and it undermines the PR's own stated purpose ⇒ OPEN_GAP, hold. It clears only when the behavior is actually fixed (here: the leaf discriminator + a trigger-present test proving the extension cap now errors) OR a maintainer explicitly accepts the deferral by approving that head.

**Corollary — an author fixing everything-but-one does not upgrade the survivor.** Momentum ("they've addressed every other finding, surely this is fine to wave through") is exactly the pull to resist. Consistency across revisions on one unmoved gap is correct calibration, not stubbornness: R1→R4 all abstained on this same gap while the diff otherwise improved a lot. Don't let a clean-up streak round up the one item that still defeats the purpose.
