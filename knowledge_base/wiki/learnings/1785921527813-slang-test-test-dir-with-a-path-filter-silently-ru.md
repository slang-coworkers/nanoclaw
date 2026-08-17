---
title: "slang-test -test-dir with a path filter SILENTLY RUNS NOTHING — 'no tests run' is not evidence a test passes"
type: learning
topic: slang-compiler
source: learnings/1785921527813-slang-test-test-dir-with-a-path-filter-silently-ru.md
---

# slang-test -test-dir with a path filter SILENTLY RUNS NOTHING — "no tests run" is not evidence a test passes

Closing out shader-slang/slang#12326 I needed to confirm that one test under `docs/generated/tests/` fails at HEAD. Three attempts printed **`no tests run`** and exit 0-ish. Read naively that says "nothing failing there" — the exact opposite of the truth. The test fails, twice.

**The trap:** for the generated-docs suite you must pass `-test-dir docs/generated/tests`, and a trailing path argument is **not** a filter in that mode:
```
slang-test -test-dir docs/generated/tests design/syntax-reference/grammar/          -> "no tests run"
slang-test -test-dir docs/generated/tests design/.../stmt-throw-no-semicolon.slang  -> "no tests run"
slang-test -test-dir docs/generated/tests stmt-throw                                -> error: Unable to launch tool 'stmt-throw'
```
Only the bare-word form errors out loudly. The two path forms fail **silently and cheerfully**, and adding `-use-test-server -server-count 4 -expected-failure-list …` (the real CI flags) does not change it.

**What works:** run the whole suite with no filter and grep the failing list. Canonical invocation is in `.github/workflows/nightly-slang-test.yml` (and `docs/generated/design/_meta/regenerate.md` § CI integration):
```
slang-test -test-dir docs/generated/tests -use-test-server -server-count 4 \
  -expected-failure-list docs/generated/tests/_meta/expected-failures.txt
```
It takes ~20-40 min but is the only reading that carries information. Then `grep -E '^docs/generated/tests/' <log>` for the failing names.

**The general lesson, which is the reusable part:** `no tests run` is a **null from the instrument**, not a measurement of the subject — and it is indistinguishable from "ran and passed" if you don't check. Before believing any zero/empty/"nothing found" result, run the **same command with the filter removed** and confirm it produces non-empty output. That no-filter run is the positive control. I only caught this because the control surfaced my target file in the failing list, sitting right where three earlier commands had claimed there was nothing to run.

Same family as a matrix whose control fails carrying zero information, and as `grep -c` returning 0 for a name that is spelled differently in the file. A filter that matches nothing and a subject that is clean produce byte-identical output; only a control separates them.

**Bonus finding from the same run, worth knowing before you cite a nightly failure:** the generated suite currently reports **34 failing tests on a clean checkout**, of which only 2 belonged to the change I was investigating. The other 32 are pre-existing and unrelated. So "the nightly is red" says nothing about whether *your* change broke something — get the per-test lines, never the job conclusion.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785921527813-slang-test-test-dir-with-a-path-filter-silently-ru.md`_
