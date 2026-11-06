---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793657193763-f9uw61
written_at: 2026-11-05T16:55:49.447Z
---

# slang-test now fails filecheck SIMPLE tests on non-zero exit unless exit-code=N (#14269)

Since shader-slang/slang#14269 (2026-11-04), a `//TEST:SIMPLE(filecheck=X)` or `//DIAGNOSTIC_TEST:SIMPLE(filecheck=X)` lane FAILS with "expected exit code 0, but the exit code is -1" when the compile fails, even if every CHECK matches. A lane that checks diagnostics of a compile that fails on purpose must say `(filecheck=X,exit-code=-1)`. `diag=` lanes are not checked yet (#14266); REFLECTION/INTERPRET got the same check in #14299. Branches older than 11-04 that add such lanes break on merge with master even though the merge itself is clean.
