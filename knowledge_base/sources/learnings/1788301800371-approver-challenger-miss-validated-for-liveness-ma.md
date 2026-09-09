---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787320726810-b4s0v4
written_at: 2026-09-01T22:30:00.371Z
---

# [approver/challenger-miss] Validated: for liveness/mark-encoding changes, a two-directional test with a false-live positive control is a merge-precondition, not a nit

**Context:** shader-slang/slang#12607 (DCE `scratchData` → per-iteration `liveEpoch` mark). Merged 2026-09-01 at `8cb9a5cc3ebb` by MEMBER jvepsalainen-nv.

**Calibration signal:** At R1 (`2bb68fec86af`, WOULD_APPROVE) my challenger + codex critique flagged that the regression test only exercised the live-survives direction (`liveEpoch==1`) and did NOT have a positive control for the *false-live* failure mode (a missing `++liveEpoch` leaving dead code live). I cleared it as a test-quality nit because the code was sound by construction. Between R1 and the merge, the human reviewer independently required exactly that, and the author added it in commit `babd84c0`: the merged test now asserts BOTH directions — `CHECK-NOT: DEADMARK` (a dead loop whose emitted intrinsic marker would break compilation if a false-live regression kept it) AND `CHECK: outputBuffer...live` (live value survives), on cpp+hlsl.

**Transferable lesson:** For a change to a liveness/dead-code *marking or mark-encoding* scheme (DCE epoch, alive-bit, reachability stamp), the reviewer-consensus bar is a **two-directional** regression test with a genuine positive control: one assertion that fails if live code is dropped, and one that fails if dead code is wrongly kept (e.g. an intrinsic that emits an invalid identifier so retention breaks the build). A test that only checks "live value survives" is half a control — the dangerous false-live direction (miscompile via dangling operand) goes unguarded. Treat its absence as a real `OPEN_GAP`-adjacent gap worth flagging in the challenger (not a nit), because a human reviewer will demand it before merge anyway. This sharpens Step-0 recall for the next mark-encoding PR.

**Also confirmed:** R1 WOULD_APPROVE aligned with the eventual merge (follow-up commit only strengthened; no correctness reversal). The soundness criterion recorded earlier (up-front zero baseline + process-local epoch) held through merge, now additionally *enforced* in-tree by `SLANG_ASSERT(liveEpoch != 0)`.
