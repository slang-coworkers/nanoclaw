---
title: "[approver/challenger] A skip-based test harness makes a removed assertion a SILENT-GREEN regression, not a nit"
type: learning
topic: review-approval
source: learnings/1785764961019-approver-challenger-a-skip-based-test-harness-make.md
---

# [approver/challenger] A skip-based test harness makes a removed assertion a SILENT-GREEN regression, not a nit

## Symptom

slang-rhi#807 (`Temporarily disable metallib_4_0 capability`) commented out the only
assertion about the disabled capability. Revision history, verified in source:

| rev | assertion |
|---|---|
| base `455d3bd0` | `CHECK(hasCapability(metallib_4_0) == (macOSMajorVersion >= 26))` |
| R1 `2f272bdc` | `CHECK_FALSE(hasCapability(metallib_4_0))` ← load-bearing |
| R2 `dc03b871` | commented out entirely — asserts nothing |

The tempting read is "commented-out test line in a 2-file, +8/-3 maintainer mitigation
= cosmetic nit." That read is wrong, and the reason generalizes.

## Root cause

In a harness that converts *capability-probe failure* into *test skip*, the regression the
removed assertion guarded is invisible in CI. In slang-rhi the chain is:

1. Availability probe compiles a trivial compute shader; failure →
   `RETURN_NOT_AVAILABLE("failed to get shader entry point code")` (`tests/testing.cpp:1002`)
   — the *exact* failure the upstream bug (slang#12325) produces.
2. Device marked unavailable → every Metal `GPU_TEST_CASE` resolves
   `SKIP("device not available")` (`tests/testing.cpp:1124`).
3. The silent-skip guard **exempts** device types that were never available:
   `if (availIt == end || !availIt->second) continue;` (`testing.cpp:1234-1240`) — even
   though it *is* wired into the exit code (`main.cpp:156-158`).

So re-enabling the capability while the bug is unfixed presents as **green CI with zero
Metal coverage**, never as a failure. The assertion was the only thing that could fail
loudly. Removing it doesn't lose a test — it converts a loud failure into a silent one.

## How to catch it

When a diff deletes or comments out an assertion, don't grade it on diff size or on the
"temporary/maintainer/tracked" framing. Ask: **if the condition this asserted regressed,
what would CI do?** Trace the harness:

- Does a probe failure become a *skip* rather than a *failure*?
- Does the silent-skip guard exempt the very state the bug induces? (Guards that skip
  "unavailable" devices are blind to bugs that *cause* unavailability — the guard and the
  bug share a trigger, so the guard can never fire on it.)
- Is there any *other* live test naming the symbol? (`grep` the tree — here,
  `metallib_4_0` appeared in exactly 2 places: the retained enum entry and this line.)

If the answer is "green either way," the removed assertion was load-bearing regardless of
how small the diff is. Severity stays LOW when the loss is confined to the workaround's
self-pinning (no product behavior loses coverage) — but LOW ≠ clears the gap bar: the
trigger is not unreachable when the TODO *explicitly anticipates* the re-enable.

## Also: an approval 19s before the finding has not considered it

`ccummingsNV` APPROVED the pinned head at `13:29:00Z`; CodeRabbit posted the actionable
comment at `13:29:19Z`. Always compare `submitted_at` of the human review against
`created_at` of the bot finding before treating an existing approval as clearing it.
Two earlier reviews were `DISMISSED` against the prior head — dismissed reviews and
reviews at a superseded commit carry no weight at the pinned head either.

## Fix

ABSTAIN_POLICY / OPEN_GAP, low severity, next-action = "human confirms the trade-off, or
restores the one-line `CHECK(!device->hasCapability(Capability::metallib_4_0))`".
Mitigation itself was source-verified correct and correctly-layered — the hold is only the
missing executable pin. See also `[approver/challenger] slang-rhi-Metal-tests-SKIP-on-macos-paravirtual`
(same harness, same blindness, arrived at from the coverage direction).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785764961019-approver-challenger-a-skip-based-test-harness-make.md`_
