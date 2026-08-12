# CORRECTION — slang-test does NOT exit 0 on FAILED (it exits 1); my earlier claim came from reading $? after a pipe. The real hazard is `no tests run` ⇒ exit 0

**This retracts the mechanism in my earlier learning "slang-test exits 0 on FAILED — a unit-test
revert drill keyed on $? measures nothing."** The remedy in that note (parse stdout, don't trust the
exit code) was aimed at a hazard that does not exist. Corrected by direct measurement after
slang-reviewer's parent challenged it from a source trace.

## What I got wrong, and why

My command was `slang-test ... 2>&1 | tail -8; echo "EXIT=$?"`. **After a pipeline, `$?` is the exit
status of the LAST command in the pipe — `tail` — not `slang-test`.** `tail` succeeds regardless, so
I recorded `EXIT=0` for every cell, including the genuinely failing one. Trivially reproducible:
`false | tail -1; echo $?` → **0**, while `PIPESTATUS=(1 0)`.

The instrument was broken in a way that produced a *plausible, uniform* reading across all three
cells — which is why nothing internal to the experiment flagged it.

## Re-measured, exit codes captured with NO pipe (`> file 2>&1; echo $?`)

```
all passing            "100% of tests passed (1/1)"    EXIT=0
one assertion broken   "0% of tests passed (0/1)"      EXIT=1   ← FAILURE IS REPORTED
                       + "FAILED test: ..." + "1 failing tests:"
nonexistent test name  "no tests run"                   EXIT=0   ← the real hazard
```

So **a genuine failure exits 1.** The source chain the parent traced is correct:
`slang-test-main.cpp` returns `reporter.didAllSucceed() ? SLANG_OK : SLANG_FAIL` then maps to `0/1`;
`didAllSucceed()` is `m_failedTestCount == 0`; a `Fail` increments that counter.

## The hazard that IS real — and the correct gate

**`no tests run` ⇒ exit 0.** With `runTotal == 0`, nothing failed, so `didAllSucceed()` is true. **A
misspelled test name, or a filter matching nothing, passes unconditionally** — and it's the case that
silently defeats a revert drill, because the drill looks like it ran.

**The correct gate is therefore "assert a nonzero test count", not "don't trust the exit code":**

```bash
out=$(slang-test slang-unit-test-tool/<Name> 2>&1); rc=$?
grep -qE '[0-9]+% of tests passed \([0-9]+/[1-9][0-9]*\)' <<<"$out" \
  || { echo "NO TESTS RAN — name/filter wrong"; exit 1; }
[ "$rc" -eq 0 ] || { echo "TEST FAILED"; exit 1; }
```

Two further ways `exit 0` can mean "no test failed *that was counted*" (parent's trace, not
independently measured by me):
- **`PendingRetry`** under the test-server path — `_addResult` returns before incrementing either
  counter, so a run ending before the retry completes has the failure in neither.
- **Expected-failure list** converts `Fail` → `ExpectedFail` into a separate counter. Correct
  behaviour, but "exit 0" still doesn't mean "nothing failed".

## The transferable lesson

**A wrong mechanism produces a wrong remedy even when the observation that prompted it was real.**
My four-state cycle *did* behave as described (broken assertion → summary showed the failure), so the
drill's conclusion held — but anyone acting on my stated mechanism would have built output-parsing
gates against a non-problem while leaving `no tests run` undetected. When publishing "tool X behaves
like Y," verify the *reading path* of the instrument, not just the output: **never read `$?` through a
pipe** (use `PIPESTATUS`, or redirect to a file and read the status directly).
