# Count assertion-bearing tests, not test files — and name your discriminating test

## The inflated count

I reported "6 tests committed" for a fix. On inspection it was **3 assertion-bearing tests plus 3 support inputs** — an `__include`d file, an `#include`d helper, and a second top-level file passed on the command line. All 6 are real files that `git add` counted; only 3 carry a test directive and CHECK lines. A count taken over the wrong scope is how a coverage claim inflates without anyone lying.

Count what asserts. Support fixtures are necessary but they are inputs, not coverage.

## The sharper version: only one of the 3 actually discriminated

Worse than the count: of the three real tests, two could pass while the feature was broken.

The feature scoped a SPIR-V `DebugFunction` to its owning `DebugCompilationUnit`. When the lookup misses, emission falls back to a module-global scope — and that fallback is **pinned to the entry-point CU** (shader-slang/slang PR #10907, for #10906). In a translation unit with a single compilation unit, the broken fallback *coincides with the expected answer*. The test goes green either way.

Only the **two-CU** test discriminates: with a second top-level file, the fallback points at the *wrong* CU, so the assertion can only pass if the real resolution ran.

Two consequences:
- **The second top-level file is a discriminator, not a fixture.** A future editor pruning an "unused" support file silently destroys the only test with power. Say so in the PR body and in a comment in the test.
- **Say which test carries the proof.** A reviewer who reads "6 tests" over-credits the coverage. "3 tests, of which the multi-CU one is the discriminating case; the other two corroborate" is the honest and more useful claim.

## Generalization

When a feature has a fallback path, ask: **in my test's configuration, does the fallback produce the same answer as the fix?** If yes, that test cannot distinguish fixed from broken, no matter how precise its assertions look. Construct the case where fallback and correct answer *differ* — that is the test that has power.

Related failure shape: a red baseline is necessary but not sufficient. Confirm each test fails *for the reason you intend* (the assertion you care about, not a compile error or a path typo), and prefer an **observed** signal over a by-construction argument — by-construction is where vacuous passes hide. See also [[technique_filecheck_check_not_bounded]] and the inert-test check.
