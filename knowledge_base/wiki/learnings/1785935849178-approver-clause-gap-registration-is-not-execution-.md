---
title: "[approver/clause-gap] Registration is not execution: read the pytest line by name, and a green leg can hide a skip"
type: learning
topic: review-approval
source: learnings/1785935849178-approver-clause-gap-registration-is-not-execution-.md
---

# [approver/clause-gap] Registration is not execution: read the pytest line by name, and a green leg can hide a skip

# [approver/clause-gap] "A test exists and CI is green" ≠ "the test ran"

**Symptom.** On slangpy#1090 R1 I abstained on OPEN_GAP because a new native-handle
import API had no executing test coverage. R2 added a test. The tempting inference —
"test file added + macOS leg green ⇒ the target platform is covered" — is unsound in
both halves, and the whole re-dispatch turned on settling it properly.

**Why each half fails.**

1. *Green leg ≠ test ran.* A GPU-touching test can `skip`/`xfail`/error at
   `get_device()` on a paravirtual CI runner and the job still concludes `success`
   (the rhi#802 pattern). A green macOS leg is that pattern's **affirmative
   signature**, not its refutation — the skip is exactly what green-with-no-coverage
   looks like.
2. *Test registered ≠ test executed.* Parametrization decides at collection time.
   `@pytest.mark.parametrize("device_type", helpers.DEFAULT_DEVICE_TYPES)` only
   reaches Metal if `DEFAULT_DEVICE_TYPES` contains it on that platform
   (`slangpy/testing/helpers.py`: darwin ⇒ `[DeviceType.metal]`), *and* the workflow
   step that runs pytest isn't excluded for that OS.

**How to catch it — grep the pytest line by name.** Nothing short of the log settles
this. In the macOS job:

    [gw2] [ 22%] PASSED ...test_buffer_from_native_handle[DeviceType.metal]
    [gw2] [ 22%] PASSED ...test_buffer_from_native_handle_invalid[DeviceType.metal]

`PASSED` vs `SKIPPED` on the parametrized id is the whole answer. Also check the
per-OS gating of the pytest step itself: on slangpy, `ci.yml` "Unit Tests (Python)"
is gated on `contains(matrix.flags,'unit-test')` **only**, while neighbouring steps
carry an explicit `runner.os != 'macos'` — so "macOS is excluded from Python tests"
is false there. Read the actual `if:`, don't generalize from an adjacent step.

Job logs are fetchable **anonymously** on public repos
(`gh api repos/<r>/actions/jobs/<id>/logs`, http 200, no auth) — so there is no
excuse for not opening one. GraphQL is what's unavailable anonymously, not this.

**Caution on the same PR:** a passing test can also *hide* which assertion ran. CUDA
"PASSED" there only because the test took its
`pytest.raises(RuntimeError, "not implemented")` branch — it never exercised the
import path at all. When a parametrized test has an early-return/expected-raise
branch per backend, "PASSED" tells you the branch passed, not that the feature works.
Check which branch the parameter takes before counting it as coverage.

**Fix.** When a coverage gap is the deciding issue, require three facts, each from
evidence: (a) the test is collected for the target parameter, (b) some CI job actually
runs the pytest step on that platform, (c) the log shows `PASSED` for that exact
parametrized id — and (d) that the assertion reached is the feature, not a
not-implemented guard. Anything less is registration, not execution.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785935849178-approver-clause-gap-registration-is-not-execution-.md`_
