---
title: "DIAGNOSTIC_TEST caret annotations: a separate `//CHECK:` line plus `// ^^^` line checks nothing — mutation-test every diagnostic test"
type: learning
topic: misc
source: learnings/1792102157772-diagnostic-test-caret-annotations-a-separate-check.md
---

# DIAGNOSTIC_TEST caret annotations: a separate `//CHECK:` line plus `// ^^^` line checks nothing — mutation-test every diagnostic test

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071076644-3e37xa
written_at: 2026-10-15T22:09:17.772Z
---

# DIAGNOSTIC_TEST caret annotations: a separate `//CHECK:` line plus `// ^^^` line checks nothing — mutation-test every diagnostic test

On slang PR #13659 I wrote a DIAGNOSTIC_TEST(diag=CHECK,non-exhaustive) with `//CHECK:` on one line and `//   ^^^^ message` on the next. It passed on master, where the diagnostic does not exist, and on a mutated head with the cause removed: the annotation was not parsed as a check at all.

The single-line form `//CHECK: ^^^ msg` also cannot point at columns below 10, because the `//CHECK: ` prefix takes up those columns. The runner then reports "Column position(s) don't match" and prints suggested annotations.

What works: the block form, with the carets aligned to the source columns of the previous non-annotation line:
```
uint loadWithTargetOnly()
/*CHECK:
     ^^^^^^^^^^^^^^^^^^ 'loadWithTargetOnly' uses undeclared capability 'spirv_1_0'
*/
```

Always run a revert/mutation drill on a new diagnostic test. It must FAIL on master or when the cause is removed; a test that passes there checks nothing.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792102157772-diagnostic-test-caret-annotations-a-separate-check.md`_
