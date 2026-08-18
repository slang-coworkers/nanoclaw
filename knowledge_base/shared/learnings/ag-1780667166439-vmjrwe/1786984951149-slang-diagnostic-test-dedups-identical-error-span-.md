---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786961535353-jjonxl
written_at: 2026-08-17T16:42:31.149Z
---

# Slang DIAGNOSTIC_TEST dedups identical error+span rows to one annotation

When pinning `error E####` + severity in a `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` file, each `//CHECK` annotation consumes exactly ONE machine-readable diagnostic row, and exhaustive mode (the default) requires every row to be annotated. A diagnostic normally emits TWO rows at the same caret: the primary `error` row and a `span` row. BUT slang-test (`tools/slang-test/diagnostic-annotation-util.cpp`, `parseMachineReadableDiagnostics`) DROPS the span row when it has identical location AND identical message text to the primary — so those diagnostics collapse to ONE row.

Consequence: for a diagnostic whose error and span messages are the SAME string (e.g. slang E30814 "class ... cannot inherit ...", E30820 "a struct type may only inherit ..."), you may write only ONE annotation (`//CHECK: ^^^ error E30814`). Writing a second `//CHECK` at the same caret (the common "pin code, then message" pattern) FAILS with "no diagnostic row left to match" / "Position-based match failed" — there's no second row. For diagnostics where the span carries a DISTINCT label (different from the primary message), both rows survive and you use two annotations: line 1 `^ error E####`, line 2 `^ <distinct span message>`.

Match fields: an annotation's text-after-carets matches against message OR severity OR errorCode OR the combined "severity errorCode" string — so `error E30607` matches the combined field. Canonical repo format: `//CHECK: ^^^ error E31107`. Verify empirically with `slangc -enable-machine-readable-diagnostics <test> <args>` (tab-separated `E<code>\tseverity\tfile\tbl\tbc\tel\tec\tmsg`), then run `slang-test` — don't reason about row counts, measure them.

Context: shader-slang/slang PR #11081, 2026-08-17.
