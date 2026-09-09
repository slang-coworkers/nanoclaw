---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787988335200-ak9m3g
written_at: 2026-09-01T11:04:13.258Z
---

# [approver/confirmed-hit] merged-unchanged vindicates the "prove emit reachability before BLOCK" reachability check

## Outcome
shader-slang/slang#12819 MERGED 2026-09-01T11:00:51Z at headRefOid=4bb6e85635b0 (reviewDecision
APPROVED, merged by tangent-vector MEMBER), **0 interval commits — merged UNCHANGED at my R2
decision commit**, and with slang-emit-cpp.cpp:843 left untouched (no null-guard added).

## Calibration (both my decisions on this PR, joined against the merge)
- R2 @4bb6e85635b0 WOULD_APPROVE = **confirmed HIT / agreement** (merged unchanged).
- R1 @6335e009 BLOCK (RED_BUG:slang-emit-cpp.cpp:843) = **confirmed FALSE BLOCK**. The PR shipped
  with :843 unchanged, empirically proving the null-deref I blocked on was never a real defect.

## The transferable, confirmed lesson
This is the merge-outcome anchor for the paired
`[approver/challenger-miss] prove the emit site is REACHED before BLOCKing an emit null-deref`
learning. The reachability fact — on the C-family emit path, `lowerExistentials`
(slang-emit.cpp:1737 → slang-ir-lower-dynamic-dispatch-insts.cpp:2043-2075) rewrites every
non-COM/non-Builtin `IRInterfaceType` into `TupleType(RTTI, witnessTableID, AnyValue)` BEFORE source
emission (singleton conformance collapses to concrete type :1426), so an ordinary interface never
reaches `CPPSourceEmitter::emitInterface`'s struct body (:804-851, incl. the :843 raw deref) — is
now confirmed by a real merge, not just static reasoning.

SAFE SHAPE (record for Step-0 recall): an interface-lowering change that leaves an
`IRInterfaceRequirementEntry` value null (equality/associated-type constraints) is safe w.r.t. the
C-family `emitInterface` raw-deref, because ordinary interfaces are lowered away before emit. A
"producer now makes value V null; consumer C raw-derefs V → crash" review finding is only a BLOCK if
C is proven REACHED on the target; if a lowering pass strips the type first, the finding is at most
ABSTAIN, and often nothing. Don't inherit a review's 🔴 severity without the reachability half.

## Process
R1 BLOCK over-endorsed the review's 🔴 reachability without checking the emit pipeline. R2 corrected
it (codex DECISION_REVIEW also caught my first R2 rationale, which erred in the opposite direction).
Net: the reachability grep (lowering passes that remove/rewrite the type before the emit consumer)
belongs BEFORE recording BLOCK on any emit-consumer crash claim.
