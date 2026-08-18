---
title: "A test-disabling mitigation can skip the wrong cases — verify the skip set against the failure set, not the issue title"
type: learning
topic: verification
source: learnings/1785891583972-a-test-disabling-mitigation-can-skip-the-wrong-cas.md
---

# A test-disabling mitigation can skip the wrong cases — verify the skip set against the failure set, not the issue title

slangpy PR #1076 "Temporarily disable intermittent profiler tests" (merged 2026-07-28) applied
`* doctest::skip()` to `tests/sgl/device/test_profiler.cpp` cases at **:332 and :598**. The cases actually
failing in CI were **:228 and :511** — a **disjoint set**. The flake therefore continued for 8 days while
everyone read the merged PR title and assumed it was handled. Because slangpy's result is reported onto slang
commits as the **required** `SlangPy Tests` commit status, each flake evicted approved slang PRs from the merge
queue (slang#12328: evicted 31s after the status failed, and the eviction silently cleared its auto-merge, so
it did not self-recover).

**Rule: when a "disable the flaky test" PR merges, diff the set of cases it disabled against the set of cases
observed failing.** They are not the same thing and nobody re-checks. Cheap check:
`git show origin/main:<testfile> | grep -n "^TEST_CASE"` to get skip states at HEAD, then pull the actual
failing case names out of primary job logs. In this instance :332/:598 were the two cases cited in the
*root-cause issue* (#1072) while :228/:511 were the two failing in *CI* — an easy and invisible mismatch when
the mitigation is written from the issue rather than from the logs.

**Corollary — `doctest::may_fail()` beats `skip()` for a flaky-but-meaningful test.** `skip` is all-or-nothing
per `TEST_CASE`, so it also drops that case's deterministic assertions as collateral, and it makes the flake
invisible so nobody notices it was mis-targeted. `may_fail` still **runs** the case and still **prints** the
failing assertions, but marks it allowed-to-fail so it does not affect the process exit code (doctest.h:
`ok_to_fail`/`testCaseSuccess` ~:3567-3584, exit at :6841 `if(p->numTestCasesFailed && !p->no_exitcode)`);
`tools/ci.py:143` runs `sgl_tests` and keys purely off the exit code, with no flake-retry anywhere. So
`may_fail` unblocks a merge queue *without blinding the suite*. Frame it as a short-lived quarantine with a
tracking issue and a removal trigger — its downside is that a genuine regression stays CI-green.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785891583972-a-test-disabling-mitigation-can-skip-the-wrong-cas.md`_
