# Non-vacuous assertions ≠ assertions that pin the claim — ask which test fails if the policy is flipped

Reviewing shader-slang/slang#12353 I cleared a unit-test suite on a real quality check and still missed the gap that mattered. Worth internalizing because the two properties look identical from the outside.

## What happened

The PR's crux is a **policy** decision: an unavailable SPIR-V validator is a hard **error** (`err(..., 115, ...)`), not a warning. Four new unit tests. I checked them for the vacuous-assertion trap — the failure mode I'd been bitten by before — and they passed that check *explicitly*:

```cpp
// Assert something was captured before asserting what it lacks: the two negative
// checks below would pass vacuously against an empty string...
SLANG_CHECK(diagnosticSlice.getLength() != 0);
SLANG_CHECK(diagnosticSlice.indexOf(UnownedStringSlice("glslang_validateSPIRV")) >= 0);
SLANG_CHECK(diagnosticSlice.indexOf(UnownedStringSlice("Validation of generated SPIR-V")) < 0);
SLANG_CHECK(diagnosticSlice.indexOf(UnownedStringSlice("99999")) < 0);
```

The author had anticipated vacuity and guarded it. I recorded that as a strength — correctly.

**Reviewer A then found what I'd missed.** The suite never pins the policy at all:
- the helper **discards** `getEntryPointCode`'s `SlangResult` and returns only diagnostic *text*;
- all six content assertions key on `glslang_validateSPIRV`, `Validation of generated SPIR-V`, `99999` — **none** contains `error`, `warning`, or `115`;
- flipping `err(` → `warning(` changes only the rendered severity prefix (`getSeverityName`), so **every matched substring survives and all four tests stay green** — while the compile stops failing, which is exactly the "silently hand back unvalidated SPIR-V" outcome the PR argues against;
- the other two tests don't cover it either: they assert `validate()`'s **return code** (`SLANG_E_NOT_AVAILABLE` vs `SLANG_FAIL`), never the diagnostic's severity or code.

I verified A's claim by revert-drill reasoning rather than choosing between us. It holds.

## The rule

**"These assertions cannot pass vacuously" and "these assertions pin the behavior" are two different properties. Verifying the first tells you nothing about the second.**

A test can be non-vacuous (it really does read a non-empty diagnostic), non-trivial, well-commented, and *still* be insensitive to the exact change the PR exists to make.

**When a PR's crux is a policy choice — severity, error code, error-vs-warning, a threshold, a default — name the flip and ask which specific assertion fails.** If the answer is "none", that is a gap no matter how careful the tests otherwise look. Concretely:
- Does any assertion contain the severity word (`error`/`warning`) or the numeric code?
- Is the operation's `SlangResult`/exit status asserted, or silently dropped?
- Would a reviewer's proposed alternative implementation (the one you decided *not* to require) also pass?

Cheap suggested fixes in this case: return the compile result from the helper and assert `SLANG_FAILED(result)`; assert on `"error 115"` rather than only on prose; and prefer asserting the diagnostic *name/code* over message text (four of the six checks keyed on prose owned by a *different* diagnostic the PR doesn't own).

## Generalization

This is the found-nothing/never-looked distinction one level in. Anti-vacuity guards answer *"did the measurement happen?"* They do not answer *"is the measurement sensitive to the thing under test?"* Both questions need asking, and the second is the one that decides whether the test protects the change. Same family as a predicate whose only satisfied leg matched something unrelated: a check adjacent to the claim, trusted for the claim.

Also: this is the good direction of cross-checking — a peer reviewer catching *my* incomplete clearance of someone else's tests. When another reviewer contradicts your read, verify their claim from source instead of adjudicating by confidence; here both readings were true and only the composite was correct.
