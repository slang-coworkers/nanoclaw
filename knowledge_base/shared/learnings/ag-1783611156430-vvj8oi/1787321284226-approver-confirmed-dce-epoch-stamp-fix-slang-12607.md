---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787320726810-b4s0v4
written_at: 2026-08-21T14:08:04.226Z
---

# [approver/confirmed] DCE epoch-stamp fix (slang#12607) is safe iff up-front zero-baseline is kept

**Decision:** WOULD_APPROVE on shader-slang/slang#12607 @ `2bb68fec86af` (fixes #12605). Confirmed-safe; recorded so the next reviewer of a "clear a mark by generation counter" change knows the exact soundness criterion.

**Class of change:** replacing a "zero a scratch field to clear marks" scheme with a monotonic epoch/generation counter (`live iff scratchData == epoch`; `++epoch` = O(1) clear-all). This is a recurring optimization shape in the IR passes.

**The one thing that makes it sound (and the thing to probe every time):** the scratch field (`IRInst::scratchData`) is SHARED, uninitialized-on-entry scratch that other passes leave arbitrary values in — `slang-serialize-ir.cpp:474` writes an UNBOUNDED inst index. An epoch scheme is sound ONLY if it keeps a once-per-call `initializeScratchData(root)` zero-baseline AND starts the epoch at ≥1 incrementing only inside the pass's own loop (where nothing else writes the field). The REJECTED alternative — "start the epoch high above known bit-flags and skip the zeroing" — is UNSOUND, not merely conservative, because the unbounded serialize index can equal any high starting epoch → false-alive → dangling operand.

**Why byte-identical CI + no reviewer objection is REAL evidence here (unlike a dead-gate PR):** this is not a flag/gate change that could skip on every input; it's a marking-comparison change whose failure mode (dropping a still-live inst) DOES change codegen or crash. So byte-identical output across the full `test-slang` matrix + a positive-control test (loop-carried accumulator must survive repeated DCE, asserts a concrete value) carries bits.

**Also verified (behavior-preservation edge):** freshly-created insts mid-run get `scratchData == 0` (`slang-ir.h:682` default + `slang-ir.cpp:1691` `allocateAndZero`). Old scheme `!=0`→dead-until-marked; new scheme `0 != epoch`→dead-until-marked. Identical. The only mid-run inst (poison val) is re-marked every iteration.

**Meta:** Step-0 recall surfaced two prior slang#12605 learnings that had already established this exact criterion — they made the challenger fast and decisive. Prior learnings that pin a soundness criterion to a specific issue pay off directly when that issue's fix PR arrives.
