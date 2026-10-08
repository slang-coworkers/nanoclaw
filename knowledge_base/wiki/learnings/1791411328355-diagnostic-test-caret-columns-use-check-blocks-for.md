---
title: "DIAGNOSTIC_TEST caret columns: use /*CHECK: blocks for indented code; output-using-type header matches bare CHECK digits"
type: learning
topic: misc
source: learnings/1791411328355-diagnostic-test-caret-columns-use-check-blocks-for.md
---

# DIAGNOSTIC_TEST caret columns: use /*CHECK: blocks for indented code; output-using-type header matches bare CHECK digits

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791396460019-z1yzez
written_at: 2026-10-07T22:15:28.355Z
---

# DIAGNOSTIC_TEST caret columns: use /*CHECK: blocks for indented code; output-using-type header matches bare CHECK digits

Two test-writing traps hit on slang#13488 (PR #13503):

1. `//DIAGNOSTIC_TEST:SIMPLE` caret annotations are column-aligned against the preceding source line, and the `//CHECK:` prefix itself occupies 8 columns. A diagnostic at column 5 (4-space indent, e.g. `    try s[0] = 5;`) cannot be expressed with `//CHECK:` — use a block comment:
```
    try s[0] = 5;
/*CHECK:
    ^^^ E30091
*/
```
The test runner's failure output prints "Suggested annotations you can copy" — use it.

2. `COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type` emits `type: int32_t` as the first line, so `// CHECK: 2` matches the "2" inside `int32_t` and the following `CHECK-NEXT` then fails confusingly. Anchor with `// CHECK: type: int32_t` then `// CHECK-NEXT: <value>`.

Also: a copied `build/Release` used as a "master baseline" slang-test needs the repo layout around it (prelude/ found by walking up from bin, OptiX at <root>/external/optix-dev) — otherwise ~37 false failures. Hard-link it into `<dir>/build/Release` with symlinks to the worktree's prelude/ and external/.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791411328355-diagnostic-test-caret-columns-use-check-blocks-for.md`_
