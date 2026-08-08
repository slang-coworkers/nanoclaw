---
title: "Cite the output-mode branch not the function slang-test XUnit keeps the raw total"
type: learning
topic: slang-compiler
source: learnings/1786092350108-cite-the-output-mode-branch-not-the-function-slang.md
---

# Cite the output-mode branch not the function slang-test XUnit keeps the raw total

**Correction and sharpening of *"slang-test N of N is a runTotal with ignored tests removed from the denominator."* The reduced-denominator arithmetic is specific to ONE output-mode branch. Stating it function-wide is refutable.**

`outputSummary` in `tools/slang-test/test-reporter.cpp` is a `switch (m_outputMode)`:

```
default: (human-readable)                     XUnit:
  :694  runTotal = rawTotal - ignoredCount      :753-770  printf("<testsuites tests=\"%d\" failures=\"%d\"
  :710  percent = passCount*100 / runTotal                 disabled=\"%d\" …", m_totalTestCount,
  :713  "N% of tests passed (pass/runTotal)"                m_failedTestCount, m_ignoredTestCount)
  :715  ", %d tests ignored"  (if non-zero)     ⇒ RAW total; ignored tests STAY in the denominator
```

⇒ **The machine-readable path already gets it right.** Ignored tests are reported as `disabled=N` against `m_totalTestCount`.

## Which branch runs, and why the defect is still live

```
grep -rn 'xunit|output-mode' .github/workflows/*.yml   → 0 hits   (CI selects no mode)
test-reporter.h:145   TestOutputMode m_outputMode = TestOutputMode::Default;
options.cpp:385,390,395   AppVeyor / Travis / XUnit are opt-in flags only
```
⇒ **CI runs the `default` branch, so the reduced denominator is what humans and log-readers see.**

⭐⭐⭐ **How to state it so it survives review:** ❌ *"slang-test hides ignored tests from the denominator"* — refuted by pointing at the XUnit path. ✅ *"the default human-readable summary computes the percentage over `rawTotal - ignoredCount`, while the XUnit path reports `disabled=N` against the raw total"* — not refutable, and **the fact that the machine-readable format already does it correctly is the strongest argument that the default is the anomaly.**

⭐⭐ **General rule: when a function branches on a mode, cite the BRANCH, not the function.** A defect claimed at function scope is refutable by any sibling branch that behaves correctly — and the correct sibling is usually the best evidence *for* the fix, so citing it costs nothing and gains a precedent.

## What this does and does not invalidate

⚠️ A `runTotal` figure is not *wrong* and does not mean tests were skipped. It **cannot distinguish** "573 assertions ran and passed" from "573 ran of a larger set." **The claim shape is invalidated, not the measurements.** The positive test remains: **absence of `, N tests ignored` on the summary line is the evidence that nothing was downgraded** — a local `3/3` with no such tail, on a host where slang-llvm (hence FileCheck) loads, is a real green.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786092350108-cite-the-output-mode-branch-not-the-function-slang.md`_
