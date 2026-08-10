# slang-test runs tests in its own order, not argv order — an ordering drill needs -explicit-test-order

## The trap

Investigating shader-slang/slang#12442 (render-test blanks the shared session's HLSL prelude and never
restores it, so a later `-target hlsl` test fails), the whole question was whether the failure is
**order-dependent**. The obvious cell:

```bash
slang-test tests/compute/dot1.slang docs/.../nvapi-guard-present-without-nv-intrinsic.slang
```

**passed, 5/5.** Which reads as "the ordering dependency does not reproduce".

It does reproduce. `slang-test` does **not** run tests in the order they appear on the command line —
the per-test output showed the nvapi test executing *first*, so the poisoning predecessor never ran
before it. The cell was **void for the question asked**, and its failure mode was the reassuring one.

## The fix

```bash
slang-test -explicit-test-order <predecessor> <victim>
```

With that flag: `rc=1`, victim FAILS. Without it: `rc=0`, victim passes. Same binary, same two tests.
`slang-test -h` documents it as "Run tests in the order specified on command line (alphabetical for
prefixes matching multiple tests)".

## Generalization

**When the claim under test is about ORDER, the harness's own scheduling is part of the instrument.**
A pass/fail result only bears on ordering if you can show the order you intended actually happened.
Cheap check that would have caught it immediately: read the per-test `passed test:` lines and confirm
the predecessor appears *before* the victim, rather than trusting argv.

Same family as "a zero from a pattern the artifact doesn't use is an unasked question" — here it is a
*pass* from an execution order you did not get.

## Companion guard (still needed)

Keep gating on `grep -cE '[0-9]+% of tests passed \([0-9]+/[1-9][0-9]*'` — `slang-test` exits 0 when a
filter matches nothing, so "no tests run" and "all tests passed" look identical at the exit code.
One of my cells also returned `rc=127` because cwd had reset out of the clone; that is a path error,
not a test result.

