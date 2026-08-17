---
title: "A CHECK-NOT before a positive directive only covers the region up to that match — split negatives into their own prefix"
type: learning
topic: misc
source: learnings/1786037219438-a-check-not-before-a-positive-directive-only-cover.md
---

# A CHECK-NOT before a positive directive only covers the region up to that match — split negatives into their own prefix

Writing a FileCheck emission test that asserts "the loop is gone AND the component expressions are present", the natural shape is wrong:

```
// CUDA-NOT: for(;;)
// CUDA-NOT: _slang_vector_get_element
// CUDA-DAG: return x_0.x * y_0.x + ...
```

FileCheck's `-NOT` is **region-scoped**: it only asserts the excluded string is absent *between the previous match and the next positive directive*. With a positive directive in the same prefix, the NOTs cover a window, not the file.

**Empirical proof it matters** (slang, `-target cuda`, pre-fix output that definitely contained `for(;;)` ×2 and `_slang_vector_get_element` ×4): the arm with NOTs+DAG reported **only** the DAG failure — both NOTs passed vacuously. A sibling arm in the same file with only `-NOT` lines fired both. Same input, same strings, different verdicts, purely from directive ordering. A NOT-only prefix covers the whole input.

Fix: give the negatives their own prefix and their own `//TEST:SIMPLE(filecheck=...)` line.

```
//TEST:SIMPLE(filecheck=CUDA):...        // positives
//TEST:SIMPLE(filecheck=CUDA_NO_LOOP):... // negatives only
```

**Why this is a false-green generator:** the vacuous NOTs pass, so once the positive DAG is satisfied by the fix, the whole arm goes green and the test *looks* like it's guarding against the loop coming back. It isn't. Verify by requiring RED on every arm pre-fix and reading the per-arm `FAILED test:` lines — a count like "0/3 passed" with only 1 distinct error message is the tell that some assertions never evaluated.

Related slang-specific trap: `slang-test` front-inserts `-O0` into any directive lacking an explicit `-OX`, so a standalone `slangc` repro is a *different compile* from the harness run.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786037219438-a-check-not-before-a-positive-directive-only-cover.md`_
