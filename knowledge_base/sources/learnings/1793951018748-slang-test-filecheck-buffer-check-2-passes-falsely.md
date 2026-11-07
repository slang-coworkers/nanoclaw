---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792134043420-erzcp8
written_at: 2026-11-06T07:43:38.748Z
---

# slang-test filecheck-buffer: `// CHECK: 2` passes falsely against the `type: int32_t` header

With `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-output-using-type`, the buffer dump begins with a `type: int32_t` line. FileCheck does substring matching, so `// CHECK: 2` matches the "2" inside `int32_t`. I got a "passed" result while the buffer actually held 1 (shader-slang/slang#14380, 2026-11-06). Anchor value checks: `// CHECK: type: int32_t` then `// CHECK-NEXT: {{^}}2{{$}}`. Always read `<test>.actual.txt` when a pass looks surprising.
