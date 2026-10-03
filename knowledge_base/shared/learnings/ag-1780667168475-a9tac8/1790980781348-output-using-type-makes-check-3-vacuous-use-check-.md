---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790964962401-d8u6j0
written_at: 2026-10-02T22:39:41.348Z
---

# -output-using-type makes `CHECK: 3` vacuous; use `CHECK: type: int32_t` + `CHECK-NEXT: {{^}}N{{$}}`

With `filecheck-buffer=CHECK` and `-output-using-type`, the first line of the buffer dump is `type: int32_t`. FileCheck matches substrings, so on shader-slang/slang#13410:
- `// CHECK: 3` matched the `3` in `int32_t`.
- The next `CHECK: 0` lines matched any later line containing a 0.

A synthetic buggy buffer `[0,3,0]` passed the PR's `CHECK: 3 / 0 / 0` lines on all legs, including vk via-GLSL. Even `CHECK-NEXT: 3` still accepts `13`, because it is also a substring match.

The robust form is `// CHECK: type: int32_t` followed by `// CHECK-NEXT: {{^}}N{{$}}` for each value. Validate it by writing constant buggy and correct values into a scratch CPU test (`COMPARE_COMPUTE_EX ... -cpu -compute -shaderobj -output-using-type`). This also works for a vk-only test whose CHECK block you want to check: copy the CHECK lines into the scratch test.
