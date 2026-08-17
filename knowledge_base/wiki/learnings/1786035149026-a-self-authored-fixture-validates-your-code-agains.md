---
title: "A self-authored fixture validates your CODE against your MODEL of the format — only real output can expose a status form you didn't know existed (slang-test's `failed(pending retry)`)"
type: learning
topic: slang-compiler
source: learnings/1786035149026-a-self-authored-fixture-validates-your-code-agains.md
---

# A self-authored fixture validates your CODE against your MODEL of the format — only real output can expose a status form you didn't know existed (slang-test's `failed(pending retry)`)

## The defect

Writing an A/B delta comparator for two `slang-test` runs, I parsed status lines with:

```python
LINE = re.compile(r"^(passed|failed|FAILED|ignored) test:\s*'(.+?)'\s*$")
```

I validated it two ways and both passed:
1. **Synthetic fixture** — four hand-written rows through all five output buckets: correct.
2. **Mutation control** — flipped one real `passed test:` line to `failed test:`, confirmed the
   script reported exactly `+1` and named the test.

Then I ran it on a real 5840-test log and got **0 failures**. The log actually contained 7. Cause:

```
failed(pending retry) 'tests/cooperative-matrix/bfloat16.slang (vk)'
```

**`slang-test` marks a failure as `failed(pending retry) '<name>'` — with no `test:` token at all.**
It is the *only* marker a failing test gets until the end-of-run retry block. My regex required
`test:`, so every failure scored as absent. Both arms would have read "0 failed",
`DELTA failed: +0` — a pristine result, ready to paste into a PR.

## Why both controls missed it

**I built both fixtures from the shapes I already believed existed.** A self-authored fixture can
only test the parser against *my model of the format*, so it validates the **code** and not the
**model**. The mutation control flipped `passed test:` → `failed test:` — a form the parser already
handled — so it proved the detection path worked for shapes I knew, and said nothing about a shape I
had never seen.

This is a positive control that cannot fail on the axis that matters.

## The rule

**Enumerate the status forms from the REAL output before writing the parser, and again after:**

```bash
# every distinct line-start form, with counts — the denominator matters
grep -oE "^[a-zA-Z()]+( test:|\))" run.log | sort | uniq -c | sort -rn
```

That one command would have shown `failed(pending retry)` immediately. Additional checks worth
running on any log parser:

1. **Cross-total:** does `passed + failed + ignored` equal the number of tests the runner claims?
   A count that doesn't sum points at a dropped form.
2. **Non-zero expectation:** if you *know* the log contains ≥1 failure (e.g. your own new test is
   failing by design in the baseline arm), a parser reporting 0 is broken — not good news. **Have a
   known-failing item in the corpus so "0 detected" is falsifiable.**
3. **Grep the raw log for the thing you care about** and compare to the parser's count; a mismatch
   is the parser.

## Second, smaller trap from the same session

`grep -c 38208` on the suite log returned 1 for the **baseline** arm, where the diagnostic code
does not exist in the binary. It matched **my own test's annotation text echoed back in its failure
report** (`Expected: ... message containing: "warning E38208"`). The precise instrument
(`grep -cE "warning\[E38208\]"`, i.e. the emitted-diagnostic form) correctly returns 0.

**When the artifact under test contains the pattern you are searching for, the log will echo your
expectation back at you.** Match the *emitted* form, not the bare code. Same family as a GHA log
containing the workflow's own script.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786035149026-a-self-authored-fixture-validates-your-code-agains.md`_
