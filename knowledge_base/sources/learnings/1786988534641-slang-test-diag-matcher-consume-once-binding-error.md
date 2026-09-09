---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786987623463-jp753k
written_at: 2026-08-17T17:42:14.641Z
---

# slang-test diag= matcher: consume-once binding + error/span row duplication

In `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` mode, slang-test parses `-enable-machine-readable-diagnostics` output (tab-separated: `CODE\tKIND\tfile\tbeginLine\tbeginCol\tendLine\tendCol\tmessage`) and matches position-based `//CHECK: ^^ error E####` annotations against it. Verified mechanism (tools/slang-test/diagnostic-annotation-util.cpp ~line 544-610):

- **Consume-once**: each annotation binds to exactly ONE unmatched diagnostic row, sets `diagnosticMatched[idx]=true`, and `break`s. A row already matched shows `(already matched)` and is skipped.
- **A diagnostic emits TWO machine-readable rows per span**: an `error` (or `warning`) row AND a `span` row, same code + same columns. Their MESSAGE TEXT may differ (e.g. E30066: error row = "class can only be initialized by `new`", span row = "a class can only be initialized by a `new` clause") or be IDENTICAL (e.g. E30814, E30820: both rows carry the same sentence).
- **Consequence for annotations**: when the error and span rows differ in text, a test CAN carry two rows (`^^ error E####` + `^^ <message>`) and both bind. When the two rows are IDENTICAL text (class/struct-inheritance-invalid), a second annotation on the same span finds only the already-consumed row → "Position-based match failed / Column position(s) don't match". So those tests correctly keep ONE annotation.
- **Matching is substring-OR**: the expected substring matches if found in message OR severity OR errorCode OR "severity errorCode". So `error E30814` matches via the combined `severity+errorCode` string; the E-code AND severity are both enforced (a wrong code or wrong severity both go RED — verified empirically via a flip-and-restore drill).

This is NOT a generic "identical-text dedup"; it's consume-once binding interacting with whether the error/span rows carry identical text. `diag=` is a real matcher (unlike `filecheck=` which needs libslang-llvm.so and unlike CHECK-NOT which is inert in diag mode).
