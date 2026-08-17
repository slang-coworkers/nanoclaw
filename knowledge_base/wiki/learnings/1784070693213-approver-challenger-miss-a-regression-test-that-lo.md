---
title: "[approver/challenger-miss] a regression test that 'looks well-formed' must also FAIL on the pre-fix code — verify it discriminates, not just that it passes"
type: learning
topic: review-approval
source: learnings/1784070693213-approver-challenger-miss-a-regression-test-that-lo.md
---

# [approver/challenger-miss] a regression test that "looks well-formed" must also FAIL on the pre-fix code — verify it discriminates, not just that it passes

**Symptom:** On slang#12034 R3, a new regression test (`debug-source-separate-compilation.slang`) asserted the fix with `CHECK-DAG: OpExtInst … DebugSource [[MODULE_FILE]] %{{[0-9]+}}`. My R3 challenger cleared it as "well-formed, two-operand pattern, trap-immune" and CI was green — so I treated the green test as evidence the fix works. In R4, the maintainer (pdeayton-nv) pointed out the test "passes before AND after the fix": the `%{{[0-9]+}}` after the filename matched the SECOND operand of a well-formed record, but nothing in the pattern REQUIRED a second operand to exist, so the buggy filename-only record `DebugSource %file` would ALSO satisfy a laxer read — the test did not actually fail on the pre-fix code. A green regression test that can't go red on the bug proves nothing.

**Root cause:** I verified the test's POSITIVE assertion (does it match the fixed output?) and its trap-immunity (does it avoid matching embedded -g2 source?), but NOT its DISCRIMINATING power (does it FAIL on the unfixed output?). "CI green on the head with the fix" is necessary but not sufficient — the same green can mean "test is correct" or "test is toothless". A regression test's whole value is the red→green transition across the fix.

**How to catch it:** When a PR adds a regression test for a bug, in the challenger explicitly ask: *would this test have FAILED on the code immediately before this fix?* Reconstruct the pre-fix output shape (here: `DebugSource %file` with the text operand dropped) and check the assertion actually rejects it. For FileCheck specifically: a bare `CHECK: … DebugSource %id %id` does NOT reject a one-operand record (FileCheck matches a substring of the line, and trailing operands are optional in the pattern) — you need an **end-anchor** (`{{$}}`) in a `CHECK-NOT` to assert "exactly one operand": `CHECK-NOT: … DebugSource %{{[0-9]+}}{{$}}`. That is exactly the fix pdeayton requested and R4 adopted. If you can't confirm the test discriminates, treat "test added" as weak evidence and lean toward caution (don't upgrade the verdict on the strength of a possibly-toothless test).

**Fix:** Add "does the regression test go red on the pre-fix code?" to the challenger checklist for any PR whose value rests on a new test. For FileCheck: watch for optional-trailing-operand laxness — anchor with `{{$}}`/`CHECK-NOT` when the bug is a *missing* operand. Pairs with the sibling learning about `-g2` embedded-source self-match traps (a test can be trap-immune yet still non-discriminating — they're independent properties).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784070693213-approver-challenger-miss-a-regression-test-that-lo.md`_
