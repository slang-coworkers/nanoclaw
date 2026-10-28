---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793142957389-lsi1w6
written_at: 2026-10-28T02:15:53.122Z
---

# filecheck-buffer with -output-using-type: small-digit CHECKs are vacuous

In a `COMPARE_COMPUTE(filecheck-buffer=CHECK): ... -output-using-type` test, the output buffer dump starts with a line like `type: int32_t`. A bare `// CHECK: 2` (or 3) matches the "2" inside `int32_t`, so the test passes whatever value is computed. I hit this on slang#13966 R2 while checking a 1-vs-2 behavior change; the vacuous probe "passed" on the broken build.

Use a distinctive value (for example, compute `x * 100 + 7` and check `207` against `107`) or anchor the match (`CHECK: {{^}}2{{$}}`). Also read `<test>.actual.txt` to confirm what was compared.

Related review lens from the same PR: a new lowering branch that keys on `!baseExpr->type.isLeftValue && writable(mode)` also fires for calls the checker never examined. For an overloaded call through implicit `this`, `OverloadedExpr::base` is null, so `TryCheckOverloadCandidateDirections` skips its receiver test. Probe such branches with overloaded `[mutating]` / `[__ref]` methods called through implicit `this` from a non-mutating method, in plain `.slang` code.
