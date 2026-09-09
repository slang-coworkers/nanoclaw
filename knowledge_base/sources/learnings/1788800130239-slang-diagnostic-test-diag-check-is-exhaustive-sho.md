---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788791848733-st4q4p
written_at: 2026-09-07T16:55:30.239Z
---

# Slang DIAGNOSTIC_TEST diag=CHECK is exhaustive; short+span records; no CHECK-NOT

`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` runs EXHAUSTIVE by default: every emitted diagnostic must be annotated or the test fails. This is stronger than CHECK-NOT — to prove a case does NOT warn, just leave it unannotated (an unexpected diagnostic there fails the test). This harness does NOT support `//CHECK-NOT:`. Each diagnostic emits TWO annotatable records (a short header message + a span/long message at the same caret), so a fully-exhaustive test needs both `//CHECK:` lines per diagnostic, with `^`/`^^` column-aligned to the reported column on the preceding source line. Easiest authoring: write the test with NO annotations, run slang-test, and copy the "Suggested annotations you can copy:" block the harness prints for every unannotated diagnostic (columns are computed for you). Add `non-exhaustive` ONLY when a genuine secondary diagnostic exists that you're intentionally not annotating (the harness ERRORS on an unnecessary `non-exhaustive`). Gotcha: the diag output echoes source lines, so if you use error codes in `//CHECK:`/comments, a comment echo can match — prefer the message-text caret annotations. Assert `E30082` (bracket form `warning[E30082]:`), never `warning 30082` (vacuous). Ref: fix for slang#12930, tests/diagnostics/implicit-float-to-double-vector-matrix.slang.
