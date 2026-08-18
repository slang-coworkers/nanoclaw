---
title: "An A/B that rebuilds in place DESTROYS ITS OWN CONTROL — preserve the baseline artifacts (bin AND lib) before building the treatment, and verify the copy is genuinely control-like"
type: learning
topic: ci-tooling
source: learnings/1786043422607-an-a-b-that-rebuilds-in-place-destroys-its-own-con.md
---

# An A/B that rebuilds in place DESTROYS ITS OWN CONTROL — preserve the baseline artifacts (bin AND lib) before building the treatment, and verify the copy is genuinely control-like

## The trap

Running a controlled A/B on a compiler change — baseline arm with the patch reverted, treatment arm
with it applied — I rebuilt **in the same build directory** for the second arm. The classification
protocol I was going to apply needs *both* binaries:

- disposition "environment artifact" = passes on an individual re-run of the **treatment** binary
- disposition "pre-existing" = fails individually on **both** binaries

The second is unverifiable once the baseline binary is gone. And it *silently* becomes unverifiable:
nothing fails, nothing warns, you simply discover at classification time that the control no longer
exists. Caught only because a reviewer asked "does the baseline binary still exist?" while ninja was
at 244/281 and **had not yet relinked** — roughly fifteen minutes of margin.

## The rule

**Preserve the control artifact before you build the treatment.** For a CMake/ninja C++ project:

```bash
cp -a build/Debug/bin build/Debug/bin.baseline
cp -a build/Debug/lib build/Debug/lib.baseline      # ← do NOT skip this
```

⚠ **Copy `lib`, not just `bin`.** In slang, `slangc` is a thin driver and the actual change lives in
`libslang-compiler.so`. Copying only `bin` preserves a binary that dynamically loads the **new**
library — a "baseline" that silently contains the fix, which is worse than no baseline because it
looks like a control and behaves like the treatment.

Run the preserved copy with `LD_LIBRARY_PATH=build/Debug/lib.baseline ./build/Debug/bin.baseline/…`.

## Verify the copy on TWO axes

A single check cannot distinguish "correct control" from "broken copy":

```bash
# 1. is it genuinely fix-absent?     expect 0
LD_LIBRARY_PATH=…lib.baseline …/slangc <positive case> 2>&1 | grep -cE 'warning\[E38208\]'
# 2. does it still WORK?             expect the expected output
LD_LIBRARY_PATH=…lib.baseline …/slangc <positive case> -o - 2>&1 | grep -c '<expected symbol>'
```

Check 1 alone is insufficient: a truncated or non-executable copy also reports **0** occurrences.
Same shape as every other instrument-validity failure — the negative result and the broken instrument
are indistinguishable without a positive control.

## Generalization

My harness guarded the treatment side thoroughly (expected `HEAD`, hook sites present in source,
built binary actually emits the new diagnostic, build exit non-zero → refuse) and **never once asked
whether the control still existed**. Guards accumulate around the thing you are changing; the
baseline is the thing you are *not* changing, so it attracts no scrutiny — and that is exactly why it
disappears unnoticed.

Corollary: prefer separate build directories per arm when disk allows (`build-baseline/`,
`build-treatment/`) so the arms are simultaneously runnable rather than sequential-only. Copying after
the fact works, but only if you remember before the relink.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786043422607-an-a-b-that-rebuilds-in-place-destroys-its-own-con.md`_
