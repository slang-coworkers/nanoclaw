---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786493941468-gnl11t
written_at: 2026-08-13T17:45:15.734Z
---

# [approver/challenger-miss] A revision that RELOCATES flagged code has not necessarily FIXED it — re-trace the moved logic, don't credit the move

**Symptom:** slang#12466 head advanced f983d487→2585260c with a large rework (+352/−231) of exactly the 4 files carrying my prior ABSTAIN concern. The primary bot review flipped from "🟡 Has issues / Major" to "🟡 Minor / no correctness issues," and `git diff --stat` showed the suspect file (`slang-ir-typeflow-set.cpp`) losing 143 lines. The easy read: "they reworked it, concern addressed." **That read was wrong.**

**Root cause of the trap:** the defect was *relocated*, not resolved. `maybeUnpackArg`'s differential-pair branch moved verbatim from `slang-ir-typeflow-set.cpp` into `slang-ir-lower-dynamic-dispatch-insts.cpp:82-100`, still initializing the converted temp only `if (as<IRBorrowInOutParamType>(paramType))` while always registering the write-back. So `BorrowIn` (read-only) reads an uninitialized differential pair + gets an inappropriate write-back, and `Ref` loses its incoming value (`IRBorrowInParamType`/`IRRefParamType` are `IRPtrTypeBase` but NOT `IRBorrowInOutParamType`). A −143 diffstat on a file is "code left this file," never "logic was fixed."

**How to catch it:** on a re-gate after a revision, diff the interval (`git diff f<prior> f<new> -- <suspect files>`) and *follow the moved function to its new home*, then re-read the exact predicate you flagged. Don't let a churned diffstat or a softened bot-verdict headline substitute for re-reading the line. `grep` the moved symbol at the new head (`git grep -n maybeUnpackArg <newsha>`) to find where it went.

**The reachability sub-lesson (why ABSTAIN, not BLOCK):** the crux was whether a `BorrowIn`/`Ref` *differential-pair pointer* param ever reaches the existential (multi-impl) witness-wrapper branch. Producer `slang-ast-type.cpp:919` DOES construct `getConstRefParamType(getEffectiveDiffPairType(...))` = a `BorrowInParamType` wrapping a `DifferentialPair` for `ParamPassingMode::BorrowIn`. BUT the passing new tests (property-accessor-6, existential get/set dispatch) pass green because **in reverse mode a differentiable accessor's `this` — even a read-only `get` — is lowered as `inout DifferentialPair` (`BorrowInOut`, the initialized/handled case)**, since the cotangent must flow back into `.d`. So green CI exercises the SAFE branch; it does not establish coverage of the suspect one. Forward-mode passes the pair by value (`in`, no temp). Parameter-mode intuitions from the surface signature (`get` looks read-only) do NOT survive autodiff lowering — check what mode the diff transform actually assigns to `this`/the pair before ruling a branch unreachable.

**Fix (what the maintainer should do):** BorrowIn — initialize the temp from source AND suppress the read-only write-back; Ref — initialize + preserve ref aliasing/visibility. Both CodeRabbit (head-current comment r3777109306, graded Minor) and the prior-head codex critique converge on the initialization.

Cross-ref: challenger CI-gate calibration (convergence of finders ≠ correctness; prove reachability at the producer); bwd_diff out/inout-param convention (a differentiable out/inout becomes a bare cotangent seed; forward-mode intuitions don't transfer).
