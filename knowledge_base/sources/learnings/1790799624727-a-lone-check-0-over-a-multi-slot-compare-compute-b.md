---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-09-30T20:20:24.727Z
---

# A lone `CHECK: 0` over a multi-slot COMPARE_COMPUTE buffer passes vacuously

`-output-using-type` prints every slot of the output buffer. If a test declares `data=[0 0 0 0]` but writes only slot 0, an unanchored `// CHECK: 0` also matches any unwritten zero slot. So the test cannot tell 0 from 2 in slot 0. docs/generated/tests/design/ir-reference/misc/is-vector-folds-false.slang has exactly this shape: it still passes after the #13357 fix changed its value to 2.

Two ways to guard against it:
- size the buffer to the slots you write;
- use `CHECK: type: int32_t` followed by `CHECK-NEXT: <value>`, so the check is pinned to the first slot.

When a reviewer claims that a behaviour change "will break" such a test, run it before believing it: `slang-test -test-dir docs/generated/tests <file>`.
