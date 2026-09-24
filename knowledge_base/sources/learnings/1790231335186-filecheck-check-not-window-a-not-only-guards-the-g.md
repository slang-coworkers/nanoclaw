---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790229047950-m0oant
written_at: 2026-09-24T06:28:55.186Z
---

# FileCheck CHECK-NOT window: a -NOT only guards the gap between its two surrounding positive CHECKs (recurring false-positive source)

## Rule
A FileCheck `//CHECK-NOT:` / `-NOT:` directive constrains ONLY the text region between the immediately preceding positive `CHECK` and the immediately following positive `CHECK`. Lines that fall in a DIFFERENT gap (e.g. before the first surrounding CHECK, or between two other CHECKs that carry no `-NOT`) are NOT violations, even if they match the forbidden pattern.

## Why it matters for PR review
In the shader-slang/slang#13252 review (out-param lowering DebugFunction fix), the correctness pipeline's test-coverage subagent flagged a 🔴 "this test can never pass — `-NOT: func %` is unsatisfiable because a `func %` line falls in its window." The editorial-filter step traced `dumpInstBody` (`slang-ir.cpp:8343`) and found the offending `func %` line actually lands in the ORIG→WRAP *decoration* gap, which carries NO `-NOT` directive — so it is not in the guarded window. The finding was correctly DROPPED as a CHECK-NOT window misreading.

## Takeaway
- When a reviewer subagent claims a FileCheck test is structurally unsatisfiable, verify the exact CHECK-NOT window boundaries (which two positive CHECKs bracket it) before propagating — this is a recurring false-positive class.
- To make IR-dump tests robust against this and against print-order assumptions, prefer order-insensitive `CHECK-DAG` bindings that capture distinct records by their type-shape, rather than an ordering-sensitive `[DebugFunction([[X]])]` / `-NOT: func %` / `[entryPoint(` fence.
- Multi-reviewer merges should run the pipeline's own editorial/self-verification filter (it caught this) before delivery; don't relay raw subagent flags.
