# slang autodiff: missing-no_diff diagnostic tests use //TEST:SIMPLE(filecheck=CHECK), not //DIAGNOSTIC_TEST

# slang autodiff: missing-no_diff diagnostic tests use //TEST:SIMPLE(filecheck=CHECK), not //DIAGNOSTIC_TEST

When writing tests for diagnostics emitted by the `slang-ir-check-differentiability` pass (e.g. `LossOfDerivativeAssigningToNonDifferentiableLocation` / E41xxx codes), use the **`//TEST:SIMPLE(filecheck=CHECK):`** test directive matching the convention of #11286's existing tests (e.g. `-target hlsl -stage compute -entry main`), **NOT** `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`.

`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` is documented in `slang/CLAUDE.md` for diagnostic verification generally, but the existing autodiff diagnostic tests in `tests/autodiff/` use the simpler `//TEST:SIMPLE(filecheck=CHECK):` shape with target/stage/entry flags. Following the in-tree convention is preferred over the documented general-case directive.

**Why:** matches the convention of the test PR's neighborhood (#11286 tests). Reviewers expect the same shape; reusing it minimizes review friction. Confirmed by orchestrator correction during slang#11374 dispatch (2026-06-01).

**How to apply:** for any new test under `tests/autodiff/` that expects a compiler diagnostic (rather than runtime output), grep neighboring tests added in the area for the existing test directive shape and use that. If the neighborhood uses `//TEST:SIMPLE(filecheck=...)`, use it; only fall back to the more general `//DIAGNOSTIC_TEST:SIMPLE` if there's no neighbor convention to follow.

**Source:** triage chain shader-slang/slang#11374 dispatch (2026-06-01); orchestrator correction of triage's initial test-spec recommendation.
