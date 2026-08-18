---
title: "Run every NEW test against the FIX-ABSENT binary and require it to FAIL — one check that catches vacuous tests, missing annotations, and unreached subjects without knowing which mode you're guarding"
type: learning
topic: misc
source: learnings/1786046580626-run-every-new-test-against-the-fix-absent-binary-a.md
---

# Run every NEW test against the FIX-ABSENT binary and require it to FAIL — one check that catches vacuous tests, missing annotations, and unreached subjects without knowing which mode you're guarding

## The anti-test

I wrote a regression test for a new compiler warning and intended to fill its `//CHECK:` annotations
from real output later. I never did. Under Slang's **exhaustive** `DIAGNOSTIC_TEST` mode, a file with
zero annotations passes **iff the compiler emits nothing** — so the test passed, the suite went green,
and it was certifying the *absence* of the feature it claimed to check.

Demonstrated mechanically against a preserved fix-absent build:

```
# on a binary where the feature does NOT exist:
overload-import-overrides-local.slang        FAILED   0/1    ✅ genuine test
overload-import-overrides-local-ctor.slang   passed   1/1    ⛔ ANTI-TEST
```

**A test that passes on the fix-absent binary would go green on a revert.** That is worse than no test:
it makes a false claim that costs the next person time to disprove.

## The gate

```bash
# every NEW test, against the binary WITHOUT the change — must FAIL
LD_LIBRARY_PATH=build/Debug/lib.baseline build/Debug/bin.baseline/slang-test <new test>
```

⭐ **Its value is that you don't have to know which failure mode you're guarding against.** All of
these collapse into "passes when it shouldn't":
- no annotations / wrong annotations (vacuous)
- the test's subject never reaches the changed code path
- the feature is broken but the test can't tell
- the test asserts something already true before the change

One check, no taxonomy required. This is strictly stronger than reading the test and reasoning about
whether it's meaningful — which is what I did, and it passed my own review.

## Prerequisite: the fix-absent binary must still exist

An A/B that rebuilds in place destroys it. Preserve **both** `bin` and `lib` before building the
change (in slang the logic lives in `libslang-compiler.so`, so a `bin`-only copy silently loads the
*new* library), and verify the copy on two axes — emits **0** on the positive case *and* still
compiles something. A truncated copy also reports 0.

## Related

This is the revert drill (stash the fix, rebuild, watch the test fail) generalised from *one* test to
*every* test, and made cheap by keeping the fix-absent binary around instead of rebuilding per test.
Same family as: an **unarmed guard** whose silence reads as a pass, and **dead coverage code** that a
future reader assumes is working. All three are *present, plausible, and structurally incapable of
failing* — and all three are worse than absence.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786046580626-run-every-new-test-against-the-fix-absent-binary-a.md`_
