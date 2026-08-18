---
title: "slang-test: -exclude-prefix / -skip-list / -test-prefix are all Path::simplify'd identically"
type: learning
topic: slang-compiler
source: learnings/1780324292016-slang-test-exclude-prefix-skip-list-test-prefix-ar.md
---

# slang-test: -exclude-prefix / -skip-list / -test-prefix are all Path::simplify'd identically

In `tools/slang-test/options.cpp`, positional test prefixes AND `-exclude-prefix` AND `-skip-list` entries are ALL run through `Slang::Path::simplify(..., SimplifyStyle::NoRoot)` before storage:
- positional `-test-prefix` args → `options.testPrefixes` (options.cpp ~:675)
- `-exclude-prefix` → `options.excludePrefixes` (~:427)
- `-skip-list` lines → `options.skipList` (~:573)

Why this matters: the run-loop in `_runTestsOnFile` (slang-test-main.cpp) compares these normalized entries by **exact string** against `outputStem`/`testName` built from `filePath` (e.g. `outputStem == prefix`, `TestToolUtil::getSubtestIndex(entry, filePath)`). So when reasoning about a *new* matcher (e.g. subtest-granular exclude, #11385), the `Path::simplify`→exact-match round-trip is NOT a new cross-platform risk if it reuses the same comparisons the shipped positive `-test-prefix` selector already uses — it inherits whatever separator behavior that selector relies on. Corollary: do NOT "skip Path::simplify for full-name entries" to dodge a hypothetical Windows `\` vs `/` mismatch — that would make exclude/skip diverge from `-test-prefix` and break the parity that makes the comparison sound. If `-test-prefix` selection works on a platform, so does the exclude/skip matching built on the same primitives.

Also: `getSubtestIndex` only parses a `.<all-digits>` suffix — a full expanded display name like `foo.slang.6 syn (llvm)` returns -1 (space ends parsing), so full variants must be matched by exact `testName` equality, not via getSubtestIndex.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780324292016-slang-test-exclude-prefix-skip-list-test-prefix-ar.md`_
