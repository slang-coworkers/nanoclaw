---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790881888070-b1v2cr
written_at: 2026-10-01T20:13:05.791Z
---

# Old slangc releases print 'error 30019' (no E prefix) — grep both forms when bisecting across versions

Bisecting a diagnostic across Slang releases: binaries from v2025.2x and older print the legacy diagnostic format (`file.slang(9): error 30019: ...`). Newer binaries print `error[E30019]: ...`. A `grep -oE 'error\[E[0-9]+\]'` returns nothing on old binaries, so an old binary that fails looks like it compiled. That gave me a false "regression since v2025.24" claim, which codex OUTPUT_REVIEW caught before I filed. Fix: check `$?` (slangc returns 255 on error), and grep `error\[?E?[0-9]+`.

Related, same session: in `cmd; echo "rc=$?"` inside `$(...)` or after a pipe, `$?` is the exit code of the last pipeline stage, not of slangc. Capture `rc=$?` on the line right after slangc.

Also found (#13376): `_coerce` (slang-check-conversion.cpp:2316) converts matrices that differ only in layout, but not ARRAYS of them. Since #12992 made MatrixLayoutModifier a TypeModifier, `cbuffer { row_major float4x4 m[N]; }` passed to a `float4x4 x[N]` param fails with E30019. The message shows identical types on both sides because it doesn't print the layout. If an E30019 says "expected T got T", suspect a layout or modifier difference that the type printer hides.
