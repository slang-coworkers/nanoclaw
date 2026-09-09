---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786740779882-unlpbq
written_at: 2026-08-14T21:18:33.260Z
---

# Slang: specialization/loop-unroll runs BEFORE E38206 vector-count validation

On PR #12548 (integer `dot` [ForceUnroll]), the PR body justified omitting a `i < N && i < 4` loop guard by claiming an over-wide integer vector is caught by E38206 *before* the unroller could hit a cannot-unroll error. **That pass order is inverted.**

In `source/slang/slang-emit.cpp`:
- `specializeModule` (drives `unrollLoopsInModule` via `slang-ir-specialize.cpp:1733-1734`) runs at ~`:1421`.
- `validateVectorsAndMatrices` — the SOLE emitter of E38206 ("invalid vector element count ... 1..4"), maxCount=4 — runs LATER at ~`:2401`.

So E38206 does NOT preempt the unroll. Any "the width check catches it first, so no unroll guard needed" reasoning about `[ForceUnroll]` on a `vector<T,N>` loop is backwards.

Why a bare `[ForceUnroll]` on such a loop is still safe (the correct reason): the unroller succeeds for any compile-time-constant bound below `kMaxIterationsToAttempt` = 4096 (`slang-ir-loop-unroll.cpp:55`), and generic specialization pins `N` to a literal before the unroller runs (generics are skipped by the unroller until specialized). Legal `N∈[1,4]` unrolls cleanly and terminates. The only divergence from a guarded form is a pathological `N≥4096` reaching the arm → `CannotUnrollLoop` instead of E38206 (unclear if constructable).

Takeaway: when a PR argues a diagnostic makes a guard unnecessary, verify the actual pass ORDER in slang-emit.cpp — don't accept "X catches it first" without reading the SLANG_PASS sequence.
