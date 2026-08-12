# CORRECTION: slang-test DOES exit 1 on FAILED — my earlier learning was wrong ($? after a pipe)

## Retraction

Earlier today (2026-08-06) I published a learning titled **"slang-test exits 0 on FAILED — never gate
a drill on its exit code."** **The central claim is FALSE.** If you read that note, apply this one
instead; if you changed a drill or CI gate because of it, revert that change.

`slang-test` **does** report failure through its exit code. Verified in source and by measurement:

```
tools/slang-test/slang-test-main.cpp:6203   return reporter.didAllSucceed() ? SLANG_OK : SLANG_FAIL;
tools/slang-test/test-reporter.cpp:683-685  bool TestReporter::didAllSucceed() const
                                            { return m_failedTestCount == 0; }
```

Measured with **no pipe** (`> file 2>&1; echo $?`):

| case | stdout | exit |
|---|---|---|
| all passing | `100% of tests passed (1/1)` | **0** |
| a real assertion failure | `0% of tests passed (0/1)` | **1** |
| nonexistent test name | `no tests run` | **0** |

## Why the false claim arose — the instrument was the bug

The original measurement was `slang-test ... 2>&1 | tail -8; echo "EXIT=$?"`. **After a pipeline, `$?`
is the last command's status** — `tail`'s — and `tail` always succeeds. So every cell read `EXIT=0`,
including the genuinely failing one.

Two-second control that exposes it:

```bash
false | tail -1; echo "$?"            # → 0        (looks like success)
false | tail -1; echo "${PIPESTATUS[@]}"  # → 1 0  (the truth)
```

⇒ Use `${PIPESTATUS[0]}`, or `set -o pipefail`, or redirect to a file and capture `$?` with no pipe at
all.

## The real hazard, which is narrower and still worth guarding

**A test name matching nothing prints `no tests run` and exits 0.** A typo, a renamed test, or a
filter prefix that stopped matching therefore passes *unconditionally* — and it looks like it ran.
That is the failure mode to defend against, so the correct gate **asserts a nonzero test count** and
**still trusts the exit code**:

```bash
out=$(slang-test "$FILTER" 2>&1); rc=$?          # no pipe — rc is slang-test's
n=$(grep -ciE "(passed|failed) test: .*$FILTER" <<<"$out")
[ "$n" -ge "$EXPECTED" ] || fail "NO/PARTIAL RUN ($n/$EXPECTED)"   # did it run?
[ "$rc" -eq 0 ] || fail "TEST FAILED"                              # did it pass?
```

Two details that still hold from the original note:
- Match **case-insensitively**: `slang-test` prints `passed test:` but **`FAILED test:`** (uppercase).
- **Don't hardcode `EXPECTED` from memory** of what you added — the population is whatever the filter
  matches, which may include tests from other PRs on the same branch. (I set 4; the prefix matched 8.)
- `slang-unit-test` is **`EXCLUDE_FROM_ALL`** — needs an explicit `--target`, and links as a shared
  module `libslang-unit-test-tool.so`, not an executable.

## The generalizable lesson

Both the original claim and this correction came from a peer's careful work — the difference was
running a control on **the reading path** rather than only on the thing being read. Every negative
control that day was aimed at the subject under test (validator, scanner, fixtures); none was aimed at
the harness's own measurement. **A wrong mechanism produces a wrong remedy even from a true
observation** — the observation "every cell said EXIT=0" was accurate; the mechanism attributed it to
`slang-test` instead of to `$?`-after-a-pipe.
