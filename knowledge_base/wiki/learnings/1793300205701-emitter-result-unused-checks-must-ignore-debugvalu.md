---
title: "Emitter 'result unused' checks must ignore DebugValue users under -g; DIAGNOSTIC_TEST needs two caret lines per rich diagnostic"
type: learning
topic: misc
source: learnings/1793300205701-emitter-result-unused-checks-must-ignore-debugvalu.md
---

# Emitter "result unused" checks must ignore DebugValue users under -g; DIAGNOSTIC_TEST needs two caret lines per rich diagnostic

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291446093-uqb9b4
written_at: 2026-10-29T18:56:45.701Z
---

# Emitter "result unused" checks must ignore DebugValue users under -g; DIAGNOSTIC_TEST needs two caret lines per rich diagnostic

From slang#14031 / PR #14044 (Metal 64-bit atomics).

1. **`inst->hasUses()` is wrong under `-g`.** With debug info, an otherwise-unused result (e.g. the `original_value` out-param of `InterlockedMin`) keeps one user: `DebugValue(%var, %result)`. The C-like emitters skip debug insts entirely (`slang-emit-c-like.cpp` returns early for kIROp_DebugValue etc.), so an emitter decision "result unused → emit void form" must loop over uses and ignore `isDebugInfoInst(use->getUser())` (`slang-ir-util.h`). Otherwise `-g` turns valid code into an error. Add a `-g` run line to the test to guard it.

2. **DIAGNOSTIC_TEST + structured diagnostics (e.g. E55204 `UnsupportedTargetIntrinsic`)**: each diagnostic yields TWO matchable entries at the same position — the header ("unsupported intrinsic operation", matched by `^ E55204`) and the span label ("intrinsic operation '...' is not supported..."). In exhaustive mode you need both caret lines per site; one alone fails with "N diagnostics without annotations". See tests/diagnostics/unsupported-target-intrinsic.slang.

3. **MSL 64-bit atomics (spec 4.1)**: only `void atomic_min/max_explicit(device atomic_ulong*, ulong, memory_order_relaxed)` (§6.16.4.6) and void `atomic_min/max(coord, ulong4)` texture members. Texture atomic_load/store/exchange/CAS/fetch_op are "for int and uint color type" (§6.13 summary). No `atomic_long`. Reporter-verified on Apple9 hardware.

4. **Worktree hazard:** `origin/master` is a shared ref with the base clone; another session's `git fetch` moves it. `git reset --soft origin/master` to re-split commits then silently "reverts" every new master commit in your index. Reset to the recorded base SHA instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793300205701-emitter-result-unused-checks-must-ignore-debugvalu.md`_
