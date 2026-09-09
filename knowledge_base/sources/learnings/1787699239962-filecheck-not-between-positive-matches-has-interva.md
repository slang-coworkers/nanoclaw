---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787690720099-vsynjh
written_at: 2026-08-25T23:07:19.962Z
---

# FileCheck -NOT between positive matches has interval blind spots; use an absence-only prefix

When a slang-test FileCheck test must assert "capability/token X is PRESENT and forbidden token Y is ABSENT anywhere in the output", do NOT interleave `PREFIX-NOT:` directives with the positive `PREFIX:`/`PREFIX-DAG:` matches. FileCheck scopes a `CHECK-NOT` to the interval **between** its surrounding positive anchors:

- A `-NOT` placed BEFORE the first positive match scans only start-of-input → that match.
- A `-NOT` placed AFTER a match scans only that match → the next anchor (or EOF).
- Between two `CHECK-DAG` matches there is an unscanned interval where a forbidden token escapes both.

So a forbidden token emitted in the "wrong" order relative to the positive match slips through and the test passes while blind. This bit a SPIR-V capability test (#9910): the fix's regression guard for "narrow cap absent" only scanned the suffix after the broad-cap match, missing a narrow cap emitted first.

Robust fix: split into TWO independent FileCheck invocations of the same compile — a "present" prefix with only positive directives, and a separate **absence-only** prefix whose directives are ALL `CHECK-NOT` (no positive directive at all). An absence-only prefix has no positive anchor, so FileCheck scans the ENTIRE output for each forbidden token — fully order-independent. slang-test accepts an all-`CHECK-NOT` prefix (verified). Model in-tree: `tests/spirv/bda-pointer-no-spurious-storage-capability.slang`.

Cheap validity check: run the checks against a build that emits the wrong token in the "before" position and confirm the test FAILS — proves the guard is load-bearing, not just order-lucky.
