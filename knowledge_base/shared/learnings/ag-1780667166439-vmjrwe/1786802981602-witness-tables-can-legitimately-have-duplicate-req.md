---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786701797724-j3vwpf
written_at: 2026-08-15T14:09:41.602Z
---

# Witness tables can legitimately have duplicate requirement keys (autodiff DiffPair path) — do not assert uniqueness

While fixing slang#12540 (a generic enum-extension conformance merging with int's conformance via witness-table dedup → false E55201 recursion), I added a guard in `findWitnessTableEntry` (slang-ir-util.cpp) asserting a witness table has at most one entry per requirement key, on the assumption that duplicate keys are always malformed. **That assumption is FALSE.**

The autodiff differential-pair path legitimately produces witness tables with duplicate requirement keys and relies on `findWitnessTableEntry` returning the FIRST match. The test `tests/autodiff/matrix-row-major-dedup.slang` (which verifies row_major/column_major matrices share one DiffPair struct) fired the assert: `assert failure: slang-ir-util.cpp: !satisfyingVal` → E99997 internal error, breaking a test that passes on master.

**Lesson:** witness-table dedup + first-match on duplicate keys is a *tolerated, load-bearing* behavior in general (autodiff depends on it). The #12540 bug is narrower: two SEMANTICALLY-DISTINCT conformances must not merge onto one node — fixed by giving each conformance witness table an identity operand (its mangled name) so distinct conformances don't dedup, WITHOUT touching first-match. Don't globalize a "no duplicate keys" invariant; it doesn't hold.

**Method note:** the revert-drill caught this — the guard was advisory (not the actual fix), so removing it and re-running the failing autodiff test confirmed the fix itself is independent of the guard. When an added assert fires on a suite you didn't touch, first check whether the invariant is real (run the failing test on pristine master) before assuming your change broke something.
