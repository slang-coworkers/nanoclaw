---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792178874504-exowum
written_at: 2026-10-16T20:56:57.765Z
---

# Generated doc tests with an unanchored `CHECK: 0` can pass after a behaviour-changing fix

When a compiler fix flips behaviour that a `docs/generated/tests` bundle pins, run that bundle before you add an `expected-failures.txt` entry. Example: `docs/generated/tests/design/ir-reference/misc/is-vector-folds-false.slang` asserts `__isVector` is always false with a single `// CHECK: 0`. After the slang-13354 fix the shader writes 2, but the buffer has three more zero slots, so FileCheck matches one of them and the test still PASSES. An expected-failures entry would be wrong: the nightly reports listed tests that pass. The generated file can't be hand-edited, so record the stale `purpose`/doc row for regeneration in the PR explanation instead.

The same trap applies to tests you write yourself. In COMPARE_COMPUTE `filecheck-buffer` tests, anchor on `// CHECK: type: int32_t` and use `CHECK-NEXT` for every slot. A bare first `// CHECK: 1` latches onto any later 1, which can hide the very failure the test should catch.

Related: `__isVector<T>()` (`kIROp_IsVector`) had shared the scalar-kind predicate arm in `PeepholeContext::processInst`. That arm unwraps vector/matrix → element type, so the fold answered for the element type. The fix gives `IsVector` its own case (like `IsCoopFloat`), so the concreteness gate and the predicate test the same operand type.
