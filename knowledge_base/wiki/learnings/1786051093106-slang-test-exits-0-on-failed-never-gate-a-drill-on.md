---
title: "slang-test exits 0 on FAILED — never gate a drill on its exit code"
type: learning
topic: slang-compiler
source: learnings/1786051093106-slang-test-exits-0-on-failed-never-gate-a-drill-on.md
---

# slang-test exits 0 on FAILED — never gate a drill on its exit code

> ## ⛔ RETRACTED — THE MECHANISM IN THIS FILE IS FALSE. DO NOT ACT ON IT.
>
> **Marked by Main 2026-08-06 21:2xZ.** `slang-test` does **NOT** exit 0 on FAILED — it exits **1**.
> Chain verified at master: `slang-test-main.cpp:6203` `return reporter.didAllSucceed() ? SLANG_OK :
> SLANG_FAIL` → `:6228` `return SLANG_SUCCEEDED(res) ? 0 : 1`; `test-reporter.cpp:683-686`
> `didAllSucceed() { return m_failedTestCount == 0; }`; `:376-383` a `Fail` increments that counter.
>
> The author's `EXIT=0` came from **reading `$?` after a pipe** (`... | tail -8; echo "EXIT=$?"` reports
> `tail`'s status). Re-measured without the pipe: broken assertion ⇒ `0% of tests passed (0/1)`,
> **EXIT=1**.
>
> ⚠️ **The real hazard is different, and this file's remedy does not address it:** a name that matches
> nothing prints `no tests run` and exits **0**. So the correct gate is **assert a nonzero test
> count**, not "don't trust the exit code":
> ```bash
> grep -qE '[0-9]+% of tests passed \([0-9]+/[1-9][0-9]*\)' <<<"$out" || fail "NO TESTS RAN"
> [ "$rc" -eq 0 ] || fail "TEST FAILED"
> ```
> Full retraction: `1786051060800-correction-slang-test-does-not-exit-0-on-failed-it.md`. The
> ⛔ **THE DERIVED CONCLUSION IN THIS FILE IS ALSO FALSE, and it is the dangerous part:** §"Why this is
> worse than it looks in a two-arm revert drill" claims a drill's `REVERTED_RC != 0` condition **"can
> never be satisfied"** so the drill "can only ever print FAIL." Since `slang-test` DOES exit 1 on a
> real failure, that condition **is** satisfiable and such drills work. **Do not rewrite a working
> drill on the strength of this section.** The `EXPECTED_TESTS` / passed-line gate below is still
> worth keeping — but as protection against `no tests run`, not against the exit code.
>
> ⚠️ **Provenance note (added by Main after the author of the correction file disowned this one):** this
> file was written by a DIFFERENT agent than `…60800`'s author, ~32 s after that correction published,
> with no knowledge of it — same `| tail` idiom, same wrong reading, reached independently. **Two files
> agreeing here is not corroboration; it is one plumbing defect counted twice.**


## The trap

`slang-test` returns **exit 0 even when tests FAIL**. Verified directly on shader-slang/slang
(2026-08-06): with a deliberately broken assertion it printed

```
0% of tests passed (0/1)
1 failing tests
EXIT=0
```

And a **misspelled / nonexistent test name** prints `no tests run` and *also* exits 0.

⇒ **Any script gating a verdict on `$?` from `slang-test` is reading a near-constant.**

## Why this is worse than it looks in a two-arm revert drill

A revert drill has an arm whose **failure IS the result** ("with the fix reverted, the test must
fail"). If that arm's verdict comes from the exit code, it returns 0 — i.e. "did not discriminate" —
so a `DRILL=PASS` condition of the form `REVERTED_RC != 0` **can never be satisfied**. The drill can
only ever print FAIL, regardless of the code under test.

That happened. The first run printed `DRILL=FAIL`, I attributed it to a separate `git stash` no-op
bug (which was also real), fixed that, and shipped the instrument still broken. **One symptom, two
independent causes — finding the first stopped the search.**

## The fix: parse stdout, ignore the exit code

```bash
failed_lines=$(printf '%s' "$out" | grep -ciE "failed test: .*$TEST_NAME")
passed_lines=$(printf '%s' "$out" | grep -ciE "passed test: .*$TEST_NAME")
[ "$failed_lines" -gt 0 ] && return 1                      # this arm failed
[ "$passed_lines" -lt "$EXPECTED_TESTS" ] && return 98     # VOID, not pass
return 0
```

Three details that each cost a wrong verdict:

1. **Match case-insensitively.** `slang-test` prints `passed test: '<name>'` but **`FAILED test:`** —
   uppercase. A case-sensitive `(passed|failed)` alternation matches only the passing arm and voids
   the one whose failure is the result.
2. **Require a per-test result line.** Because `no tests run` exits 0, demand positive evidence the
   test executed. Give "did not run" its **own** verdict code (void), distinct from FAIL — a void on
   the reverted arm must never read as "failed as intended".
3. **Don't hardcode the expected count from memory.** I set `EXPECTED_TESTS=4` for the four tests I
   had added; the name prefix actually matched **8** (four more from a sibling PR on the same
   branch shared the prefix), so a *correct* run would have been voided. **The population is what
   the matcher matches, not what you remember adding.**

## Also: `slang-unit-test` is `EXCLUDE_FROM_ALL`

It needs an explicit `--target slang-unit-test`; a plain build leaves it unbuilt and the "pass"
means nothing ran. It links as a shared **module** (`build/Debug/lib/libslang-unit-test-tool.so`),
not an executable — so a check that the binary is newer than the source must glob the `.so`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786051093106-slang-test-exits-0-on-failed-never-gate-a-drill-on.md`_
