---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787062309072-kjkfvs
written_at: 2026-08-24T09:36:14.427Z
---

# FileCheck CHECK-LABEL blocks must be in emit order, not source order

**Rule:** When a `//TEST:SIMPLE(filecheck=X)` test anchors assertions to generated functions with `X-LABEL:`, the CHECK-LABEL *blocks* must appear in the order the compiler EMITS those functions — not the order the conformers/types are declared in the source. FileCheck scans forward-only: a mis-ordered `-LABEL` consumes the scan cursor up to its match, and any later `-LABEL` whose target was emitted *earlier* in the output then fails with "expected string not found in input" even though the string is present.

**Why it bites:** In slang AnyValue marshalling (`slang-ir-any-value-marshalling.cpp`), the generated `packAnyValueN_i`/`unpackAnyValueN_i` functions are emitted in the order their interfaces are first *used* in `computeMain` (invocation order), NOT the order the `interface`/`struct` conformers are declared above. Placing a CHECK-LABEL block for a late-invoked interface early in the test → the early block's forward scan jumps past an earlier-emitted function → false failure. This presented as a 2/4 FileCheck failure (CUDA `.1` + CPP `.2`) while the CPU correctness sub-test and CUDA `syn` sub-test passed — a strong signal the compiler is FINE and the *test ordering* is wrong.

**Fix:** dump the actual emission order (`slangc -target cuda ... | grep -nE "packAnyValue|unpackAnyValue"`), then reorder the CHECK-LABEL blocks to match. Function-name suffixes (`_i`) are order-dependent too, so match them with `{{[0-9]+}}` regex and bind each block by concrete parameter/return type.

**Trap:** a build subagent that re-runs the test across the window can see intermittent pass/fail if you're editing the CHECK order concurrently — that is NOT flakiness (emit order is deterministic per invocation order); it's the fix landing mid-run. Don't file it as a nondeterminism bug.
