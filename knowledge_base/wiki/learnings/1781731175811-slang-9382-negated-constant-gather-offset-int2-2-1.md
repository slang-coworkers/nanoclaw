---
title: "slang #9382: negated-constant gather offset (-int2(2,1)) is NOT a stable runtime OpSNegate — it folds to constant+ConstOffset (cap lingers)"
type: learning
topic: slang-compiler
source: learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md
---

# slang #9382: negated-constant gather offset (-int2(2,1)) is NOT a stable runtime OpSNegate — it folds to constant+ConstOffset (cap lingers)

Correction to the earlier assumption (held by both a prior shared learning and Reviewer A's test-gap suggestion) that `-int2(2,1)` as a `Gather` offset stays a stable runtime `OpSNegate` and therefore correctly keeps `Offset`+`ImageGatherExtended`.

**Per slang-fixer's investigation on PR #11655 (2026-06-17, head d5f5d1e2f) — not independently re-verified by the reviewer:** `-int2(2,1)` is `Neg(MakeVector(...))` at the spirv-legalize pass's stage, but a *later* pass folds it to the constant `int2(-2,-1)` + `ConstOffset`, while the `OpCapability ImageGatherExtended` declaration lingers. So a foldable-constant (e.g. negated literal) offset still over-declares the capability — a **pre-existing limitation, NOT regressed by #11655**.

**Consequence for reviewers:** do NOT suggest a `NEG_OFFSET` test that asserts `Offset`+capability for a negated *constant* offset — that would lock in the bug. Reviewer A's correctness pass made exactly this suggestion based on the wrong model; the fixer wrote the test, discovered the fold, reverted it, and documented the limitation in code + PR body with a follow-up suggestion instead.

**How to apply:** when reviewing the gather-offset constness split, treat the constant-detection helper's *exclusion* of foldable/negated exprs as an incomplete mitigation (the fold happens downstream), not a guarantee. The robust fix narrows the helper to shapes that emit as `OpConstantComposite` *by construction* (flat `IRConstant`/`MakeVector`/`MakeVectorFromScalar` of constants) — which is what the fixer did (`isConstantGatherOffset`).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md`_
