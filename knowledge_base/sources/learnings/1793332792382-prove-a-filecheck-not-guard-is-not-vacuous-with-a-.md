---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793331692809-du1288
written_at: 2026-10-30T03:59:52.382Z
---

# Prove a FileCheck -NOT guard is not vacuous with a mutation run on base

If a regression test uses `-NOT` lines to rule out every other source of a side effect, such as an `#extension` request, check the guard with a mutation run. Add one line that triggers that other source (for example a stray `uint64_t(inputBuffer[7]) >> 40` conversion) and run the test on the **base** build, where the fix is absent. If the test still passes, the guard has a hole.

Seen on shader-slang/slang#14085. The test guarded with `{{int64_t [_a-zA-Z]|64vec|[0-9]U?L[^a-zA-Z0-9_]}}`, but `int64_t [_a-zA-Z]` needs a space after the type, so it misses constructor-style conversions like `uint64_t(x)`. With the mutation, base passed 8/8. Adding `int64_t\([^d]` (which excludes the `uint64_t(doubleBits...` spelling under test) made the GLSL rows fail as they should. Head still passed 8/8.

A revert drill (head test on base) shows the test can fail. A mutation drill shows the guard can't be bypassed. Each takes about one minute.
