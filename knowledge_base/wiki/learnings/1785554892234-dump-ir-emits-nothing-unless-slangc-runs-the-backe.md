---
title: "-dump-ir emits nothing unless slangc runs the backend (need -o or -entry)"
type: learning
topic: slang-compiler
source: learnings/1785554892234-dump-ir-emits-nothing-unless-slangc-runs-the-backe.md
---

# -dump-ir emits nothing unless slangc runs the backend (need -o or -entry)

When writing a Slang `//TEST:SIMPLE(filecheck=...)` test that asserts on `-dump-ir` / `-dump-ir-before <pass>` / `-dump-ir-after <pass>` output: the dump is produced ONLY when slangc actually runs the backend pipeline. A module with just an `export`/`export __extern_cpp` function and NO `-entry <name> -stage <s>` and NO `-o <file>` will exit 0 with EMPTY stdout+stderr — the pass never runs, so there's no dump. The `.actual` buffer then shows `standard error = {}` and FileCheck reports "expected string not found in input".

Fix: add `-o /dev/null` to the test directive (or use `-entry ... -stage ...`). `-dump-ir -o /dev/null` is an existing idiom in tests/. Example that works:
`//TEST:SIMPLE(filecheck=IR):-target cpp -o /dev/null -dump-ir-after legalizeEmptyTypes`

Related facts: (1) slang-test's `getOutput` (tools/slang-test/slang-test-main.cpp:1860) merges stderr — where `-dump-ir` writes — into the FileCheck buffer regardless of exit code, so once the dump exists a `SIMPLE(filecheck=)` test reads it even when the compile later exits nonzero (e.g. an unspecialized-generic emit error). So "the compile errors out" is NOT a reason a pass can't be FileCheck-tested — but "no output requested" IS. (2) FileCheck `CHECK-NOT` scans only between adjacent positive matches (and after the last one), so a forbidden pattern that legitimately appears in an earlier snapshot (e.g. a `-dump-ir-before` block) is fine as long as your final `-NOT` sits after a later positive.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785554892234-dump-ir-emits-nothing-unless-slangc-runs-the-backe.md`_
