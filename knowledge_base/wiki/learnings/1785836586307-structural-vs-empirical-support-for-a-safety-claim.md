---
title: "Structural vs empirical support for a safety claim — and which discriminator actually decides gateability"
type: learning
topic: agent-ops
source: learnings/1785836586307-structural-vs-empirical-support-for-a-safety-claim.md
---

# Structural vs empirical support for a safety claim — and which discriminator actually decides gateability

# Two supports for the same claim are not equally strong: structural covers untested inputs, empirical is only a floor

From shader-slang/slang #11917 batch-2 (PR #12336, gating IR lowering passes on a scan flag). I defended
one behavior-capable line with two independent arguments, and a reviewer named why only one of them makes
it safe to ship.

The line set a flag redundantly: `result.tagType = true` in the arm that already sets `result.tagOps`.
Question: can that change behavior?

- **Empirical support:** across the corpus I probed, the control matrix never showed `tagOps=1` with
  `tagType=0` — they always moved together.
- **Structural support:** all four tag operations are *typed* `SetTagType`, and `SetTagType` is
  `hoistable = true` (`slang-ir-insts.lua:854`), so the type instruction is interned at module scope and
  the scan — which recurses children, not operands — already saw it. `tagType` was therefore *already*
  true wherever `tagOps` was.

**The empirical result is a floor over the inputs you ran. The structural one holds over inputs you
didn't.** Only the second licenses the claim for cases outside the corpus. Collect both when you can, but
know which one you're leaning on — and if you only have the empirical one, say the claim is bounded by
your corpus.

**Then state the failure direction.** Here the worst case is a pass running when it would have been a
no-op: wasted work, never missed lowering. That asymmetry — stale-TRUE costs time, stale-FALSE is a
miscompile — is what makes shipping acceptable. A safety argument isn't complete until you've named which
way it fails.

## The discriminator for "can this pass be gated on its opcodes?"

The same question got opposite answers for two neighbouring passes in one file, and the deciding property
is **not** the one you'd reach for first:

- `lowerTagInsts` / `lowerTagTypes` — gateable. Their entire work is keyed to opcodes present in the
  module; absent those, they are genuinely no-ops.
- `lowerSequentialIDTagCasts` — **not** gateable on its opcodes. Its `processModule` first calls
  `ensureWitnessTableSequentialIDs()` unconditionally, which writes
  `linkage->mapMangledNameToRTTIObjectIndex` — state that **outlives the compile** and is read elsewhere.
  So it may still have work on a module containing neither opcode it lowers.

⇒ **The discriminator is "does the pass mutate state that outlives the compile / isn't opcode-scoped?",
not "is the opcode present?"** Before gating any pass, read its whole entry function looking for work
that isn't keyed to the opcode family — a second unconditional call, a side table, a linkage write. Two
passes can look interchangeable at the call site and differ entirely here.

Bound the resulting claim precisely: this rules out an *opcode-only* gate while that side effect stays in
the pass. It does **not** prove no gate could work — a flag also covering the extra work, or splitting
that work into its own pass, could be sound.

## A bias worth naming out loud

After several rounds of retracting my own over-claims, I noticed I was tempted to let a scope caveat
discount a *real* finding. A reviewer's framing stuck: **a run of retractions biases toward
under-claiming, and under-claiming a live defect costs more than the over-claim you're correcting for.**
The target is not "claim less" but "claim exactly what the evidence supports" — which sometimes means
asserting a finding firmly immediately after retracting three others. Related asymmetry when re-reviewing
a *fixed* tree: a clean result is weak evidence (different artifact than the one reviewed), but a finding
is strong evidence regardless, because it is live in the code you would ship.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785836586307-structural-vs-empirical-support-for-a-safety-claim.md`_
