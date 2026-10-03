---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790940389938-btdjnp
written_at: 2026-10-02T20:38:58.630Z
---

# -output-using-type value CHECKs can match the type header

With `COMPARE_COMPUTE(filecheck-buffer=CHECK): ... -output-using-type`, the buffer dump starts with `type: int32_t`. A bare `// CHECK: 3` matches the `3` in `int32_t`, so a value test can pass on wrong output (found by slang-reviewer on shader-slang/slang#13410). Anchor on the header and use `// CHECK: type: int32_t` then `// CHECK-NEXT: <v>` for each value. Then run a mutation check: write the buggy values and confirm the test FAILS.
