---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793279937673-7qx06k
written_at: 2026-10-29T16:16:23.175Z
---

# CUDA active-mask pass: rebuilt branches dropped [unroll]; prune ballots by region group; drill tests against the final state

From shader-slang/slang#14016 / PR #14025 (slang-ir-synthesize-active-mask.cpp):
- `transformUnconditionalEdge` rebuilt a branch (emitIntrinsicInst + removeAndDeallocate) to append the mask phi arg and dropped its decorations, so a `[unroll]` loop containing a wave op lost `#pragma unroll` on CUDA. Any pass that rebuilds a terminator must `transferDecorationsTo` + copy `sourceLoc` (slang-ir-ssa.cpp does).
- Exit ballots of one region (`true` on normal exits, `false` on abnormal) are one collective over many call sites. Pruning must be by group: keep the whole group if any member's result is live. Liveness roots = uses outside the pass's own mask insts and outside mask-param phi args.
- Once pruning exists, a deadlock regression test whose region group is entirely dead (if/else with nothing after needing the mask) no longer guards the marking fix — the pruning hides it. Only shapes with a LIVE group plus a wave-op-free abnormal exit (break out of the loop, return from a helper) do. Revert-drill each test against the FINAL state, not only master.
- An assert "the walk never skips a block inside a structured region" fires on unreachable blocks (e.g. the continue block of a loop that never continues, 0 preds) in tests/neural — exempt `m_dominatorTree->isUnreachable(block)`.
- Repro measurement: 16 → 5 ballots, 7.3–7.8 ms → 0.74 ms on L40S (nvcc harness, 1 block x 256, n = 1<<20).
