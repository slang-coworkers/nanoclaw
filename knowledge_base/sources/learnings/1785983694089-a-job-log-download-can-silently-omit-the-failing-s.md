# A job-log download can silently omit the failing step: read step conclusions, not just the log body

Measured on shader-slang/slang CI, 2026-08-06 (#12096 chain).

## The trap
`gh api repos/O/R/actions/jobs/<id>/logs` on a FAILED job returned 2.73 MB of log containing
**zero** `FAILED test:` and zero `failed test:` entries, with a must-hit control of 8,737
`passed test:` lines. Read naively that says "the job failed but no test failed" — which is a
finding-shaped statement built on an aperture, not on the world.

## What actually establishes the failure
The job's **step conclusions** do:

```bash
gh api repos/O/R/actions/jobs/<id> --jq '.steps[] | select(.conclusion!="success") | "num=\(.number) concl=\(.conclusion) name=\(.name)"'
```

That named `Run Tests with Coverage (Linux/macOS)` = `failure`. The real cause was in the log all
along but not as a test entry:

```
run-coverage.sh: line 306: 49522 Segmentation fault: 11  "$SLANG_TEST" "${TEST_ARGS[@]}"
##[error]Process completed with exit code 139.
```

⇒ the harness **crashed**, so it never emitted a per-test failure line. "No failing test entry"
and "no failing test" are different claims.

## Two things that misled me on the way
1. **A shorter log looks like truncation.** The failing log was 1.27 MB shorter than a passing
   one, so I hypothesised a truncated download and re-fetched via the run-level archive
   (`actions/runs/<id>/logs`, a zip). It returned **byte-identical** 2,734,643 bytes ⇒ the log was
   complete and my truncation story was wrong. A size delta between a red and a green run is
   explained by the red one *doing less work*, not necessarily by a lost download.
2. **Grep case matters and neither case existed.** I checked both `FAILED test:` and
   `failed test:` (0 and 0). Checking both spellings was right and still told me nothing, because
   the entry class was absent, not misspelled.

## Rule
When attributing a CI failure to a cause, the evidence chain is
**step conclusion → the step's own error line → per-test entries**, in that order. Per-test
entries are the *last* place to look, because a crashed or skipped harness produces none — and
their absence reads exactly like "nothing failed".

Corollary: an upstream claim of the form "the failures were <test-suite X>" is checkable in one
command. Here the relayed claim was "docs/generated IR-reference tests"; measured on the log,
`ir-reference` = 0 and `tests/design` = 0 against a must-hit control of 16,990 `tests/`, and the
only two `docs/generated` hits were **shell comments in the workflow script**. The relayed
conclusion (unrelated to the issue under triage) was correct; its stated cause was not. Audit the
mechanism separately from the conclusion.
