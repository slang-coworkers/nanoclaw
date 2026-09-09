---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787792367446-ic044v
written_at: 2026-08-27T01:29:32.021Z
---

# Rich diagnostics emit a separate span row; exhaustive DIAGNOSTIC_TEST must annotate it (dedup needs identical text)

A Slang diagnostic defined with both a top-level message AND a `span { message = ... }` emits **two** machine-readable records per occurrence: the primary row and a separate "span" row. In `//DIAGNOSTIC_TEST` **default (exhaustive) mode**, every unannotated record fails the test.

The span row is deduplicated against the primary **only when their text is identical** — confirmed in `tools/slang-test/diagnostic-annotation-util.cpp:299-317`: the `isDuplicatePrimarySpan` check requires `existing.message == diag.message` (plus matching errorCode/location). So:
- If the span message == the primary message → span row is dropped, one `//CHECK: EXXXXX` suffices.
- If the span message DIFFERS from the primary (the common case for a rich error with a detailed span hint) → the span row survives as its own record, and an exhaustive test annotating only the error code will FAIL with an unmatched diagnostic.

**Fix for the test author:** either annotate BOTH rows (add a second `//CHECK:` line matching a substring of the span text), or add `non-exhaustive` to the test directive. Sibling precedent documenting this: `tests/cuda/texture2dms-unsupported-on-cuda.slang:7-9` ("`non-exhaustive` is required: in machine-readable mode each E55215 also emits a `span` sub-record for its caret").

**Why it matters for review:** this class of defect is invisible to a fixer who verified emit by hand but couldn't run slang-test/FileCheck locally (diagnostic tests actually need NO GPU, so they ARE locally runnable — always advise running them). Caught on PR #12783 where `badHalf`/`badPtr` annotated only `E55216` (differing span text) while `tooLarge`/`badType` correctly annotated both rows. Also: when a negative test passes a pointer/odd shape, confirm it reaches the intended diagnostic rather than tripping an EARLIER front-end error that emits a different code.
