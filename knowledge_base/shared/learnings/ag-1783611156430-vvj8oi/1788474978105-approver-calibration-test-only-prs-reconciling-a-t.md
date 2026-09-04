---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788470147422-efbgwo
written_at: 2026-09-03T22:36:18.105Z
---

# [approver/calibration] Test-only PRs reconciling a test vs a concurrently-merged PR's new diagnostic are a recurring safe shape

## Shape

shader-slang/slang#12903 (a `fix/issue-12902` fixer, authored by `nv-slang-bot[bot]`,
CONTRIBUTOR) was a **test-only** change (+6/-2 in `tests/`): it updated two autodiff
overload-resolution tests to account for warning **E40021** that a *different* PR (#12830)
had just introduced. #12830 and #12828 (last to touch the same test files) merged ~2 minutes
apart, so neither PR's CI observed the other — a **semantic merge conflict**: master went red
not from a compiler regression but because a test's expected output predated a warning now
emitted on the exact generic-overload pattern the test exercises. The fix suppressed E40021 on
the compute directives (`-warnings-disable 40021` for `slangc`; `-xslang -Wno-40021` for the
COMPARE_COMPUTE harness line) and added exhaustive caret annotations in the DIAGNOSTIC_TEST.

## Outcome

Decision: ABSTAIN_POLICY / CLAUSE_FAIL:author_trust (bot CONTRIBUTOR ∉ trusted set under the
absent-mount bundled `v0-shadow`). The PR **merged unchanged** at the exact decision commit
(`3ce8f242a5c5`, merged by MEMBER tangent-vector who owns #12830) with 0 follow-up commits.
Devin had cleared it (0 bugs/0 flags). So the code shape was genuinely safe; the abstain was a
shadow-mode false-abstain *by design* (excluded from agreement scoring, not a miss).

## Transferable signal (sharpen Step-0 / challenger recall)

- **Recognize the shape fast:** "master is red on every PR after two PRs merged minutes apart,
  and this PR only edits test expectations to absorb a new diagnostic/warning from one of them"
  = stale-test-expectation reconciliation, not a behavior change. Low intrinsic risk; the whole
  diff lives in `tests/`. This class recurs whenever a diagnostic-adding PR and a
  test-touching PR race the merge queue.
- **What the abstain SKIPS:** because these fixer PRs are bot-authored, author_trust FAILs at
  Step 1 and the challenger never runs — so the vacuity / positive-control probes (does
  `-warnings-disable 40021` actually bind? is the SIMPLE-line flag inert because that sub-test
  only greps stdout? are the caret annotations exhaustive so the DIAGNOSTIC_TEST can't pass
  vacuously?) are never exercised by the approver. Under the current mount these PRs ship on the
  strength of the human reviewer + Devin alone. If the mount is ever fixed to trust the fixer
  bot, THOSE are the probes the challenger must run on a diagnostic-suppression/annotation diff —
  a suppressed/downgraded diagnostic is the low-scrutiny direction and can pass vacuously.
