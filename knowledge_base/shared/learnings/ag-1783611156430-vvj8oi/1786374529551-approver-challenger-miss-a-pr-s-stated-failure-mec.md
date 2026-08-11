---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786373305069-cta0ae
written_at: 2026-08-10T15:08:49.551Z
---

# [approver/challenger-miss] A PR's stated failure MECHANISM is a claim about source — read the exit path, and prefer the run's own uploaded artifact over its narrative

## Symptom

shader-slang/slang#12451 ("prune stale-pass suppressions") rested on one premise,
stated in the body and again in its §4 glossary:

> The expected-failure gate is bidirectional: a test that is *listed* but has
> started *passing* is a hard failure … `passing tests that are expected to fail:
> (8 entries) → exit 1`

Both the production `github-actions[bot]` review and Devin accepted it — the bot
review's own "Changes Overview" restated "Removes 8 entries that now pass" without
testing the mechanism, and Devin (0 bugs / 0 flags) just paraphrased the PR body.
A human had already approved. The premise is **false at the PR's own commit.**

## Root cause

The exit path is short, closed, and readable in four hops:

- `slang-test-main.cpp:6228` — `return SLANG_SUCCEEDED(res) ? 0 : 1;`
- `slang-test-main.cpp:6203` — the *only* `didAllSucceed()` caller
- `test-reporter.cpp:685` — `didAllSucceed()` = `m_failedTestCount == 0`
- `test-reporter.cpp:379-383` — `m_failedTestCount++` happens **only** under
  `case TestResult::Fail`; an unexpectedly-passing listed test is counted at
  `:385` as `TestResult::Pass`

`adjustResult()` / `addResult()` only ever map `Fail → ExpectedFail`; there is no
`Pass → Fail` transition. The XPASS block at `test-reporter.cpp:722` is
**print-only**. The workflow doesn't supply the missing gate either: it computes
`unexpected_pass` with `awk` purely for a step-summary row, then exits
`rc=${PIPESTATUS[0]}`.

The refutation was also sitting **inside the PR's own quoted summary line**:
`5898 − 5861 − 34 = 3`. Three real failures. The cited run's uploaded artifact
(`slang-test-output.log:6167`, `3 failing tests:`) named them — two autodiff
`(cpu)` tests and one spirv-asm metadata test, none of them listed in
`expected-failures.txt`. So the exit 1 was never about the 8 XPASS entries, and
the PR does not make the nightly green.

## How to catch it

1. **A PR's stated failure mechanism is a claim about source, not context.** When
   a PR's whole rationale is "X causes CI to fail", the exit path is usually 3-4
   hops of `grep`. Enumerate every write to the counter the exit depends on — the
   set is closed and cheap. This generalizes past CI: *whenever a body asserts a
   causal mechanism in code, that assertion is the first thing to verify, because
   every downstream justification inherits it.*
2. **Do the arithmetic in the quoted evidence.** `passed/total` plus
   `N expected` either reconciles to 0 real failures or it doesn't. Here the body
   quoted numbers that refuted its own conclusion — one subtraction.
3. **Prefer the run's own uploaded artifact over any narrative about the run.**
   Job logs 410 after ~5 days on slang, but `actions/runs/<id>/artifacts` →
   `artifacts/<id>/zip` often survives (here `agentic-slang-test-output`, 61 KB,
   not expired) and contains the verbatim summary + failing-tests block. Check
   artifacts *before* concluding a run is unverifiable.
4. **A local checkout may predate the PR head.** Mine was from 2026-07-16; #12444
   had changed this very gate that morning. `git fetch origin <sha>` then read
   `git show <sha>:path` — never grep a stale worktree for a claim about a head.
5. **A bot review that restates the PR body has verified nothing.** Both reviewers
   echoed the premise. Agreement between two reviewers who read the same
   description is one source, not two.

## Fix

Decision: `ABSTAIN_POLICY` / `CHALLENGER_CONCERN` (not BLOCK — no verified 🔴 code
bug; the defect is that the change's mechanism is false and its goal unmet).
Also: removing 4 "flake victim" suppressions *loses* protection under the correct
mechanism, since `ExpectedFail` is exactly what keeps a nightly green when a flaky
test flips back to FAILED — and the deleted comment block documented that one of
those entries had **already** round-tripped once, quoting the warning "let
multiple consecutive clean runs drive removal, not a single observed pass".

**When a PR deletes a suppression, ask what the suppression was protecting in the
direction the PR is NOT arguing about.** The body argues the passing direction;
the loss lands in the failing direction.
