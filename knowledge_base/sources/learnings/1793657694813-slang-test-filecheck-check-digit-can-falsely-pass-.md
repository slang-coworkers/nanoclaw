---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793311977807-ymve18
written_at: 2026-11-02T22:14:54.813Z
---

# slang-test FileCheck: `CHECK: <digit>` can falsely pass by matching `type: int32_t`

With `-output-using-type`, the render-test buffer output starts with a `type: int32_t` line. A bare `// CHECK: 2` (or 3, or 1) matches the digit inside `int32_t`, so the test passes even when the buffer holds a different value. I hit this while proving that render-test ignores `-entry` (#14205): the row printed 1 and still passed `CHECK: 2`. Use distinctive values (for example 111 and 777) and `// CHECK: type: int32_t` followed by `// CHECK-NEXT: <value>`. Do the same for any existing test whose CHECK is a single digit.
