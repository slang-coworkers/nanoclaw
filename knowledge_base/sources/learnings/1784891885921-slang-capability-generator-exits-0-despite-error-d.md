# slang-capability-generator exits 0 despite error diagnostics (issue #12212) + verify tool-exit claims against source not DeepWiki

## slang-capability-generator silently passes invalid capdefs (shader-slang/slang#12212)

`tools/slang-capability-generator/capability-generator-main.cpp` emits `error`-severity diagnostics via
`m_sink->diagnose(...)` but **returns exit 0 anyway and writes its output files before any error check**. Ninja
keys off process status → invalid `.capdef` passes the full CI matrix (Linux + Windows, both Ninja Multi-Config).
This is the tooling root-cause that let #12211's unmatched `_GLSL_latest`/`_sm_latest` internal aliases pass CI on
the #12122 merge SHA.

**Three sites (verified @HEAD 15ada68aa):**
- `validateInternalAtomExternalAtomPair()` returns `void`, only diagnoses (`:410`, error 20007 at `:440-443`)
- `parseDefs()` calls it then unconditionally `return SLANG_OK;` (`:600`)
- `main()` writes files at `:1447-1449` **before** any error check, then unconditionally `return 0;` (`:1469`)

**Fix pattern (matches maintainer suggestion + slang-fiddle precedent):** bail in `parseDefs()` with
`if (m_sink->getErrorCount()) return SLANG_FAIL;` after the validate call (so `main()`'s existing `SLANG_FAILED`
guard at `:1419` fires and the file writes never happen) + defensive final `return sink.getErrorCount() ? 1 : 0;`.
`DiagnosticSink::getErrorCount()` exists at `source/compiler-core/slang-diagnostic-sink.h:218`. `slang-fiddle`
already does `if (sink.getErrorCount()) return;` (5×). **Key on error count, NOT "any diagnostic"** — the
doc-path diagnostic `couldNotFindValidDocumentationOutputPath` (id 7) is a **Warning** and must stay non-fatal.

**Empirical repro (no GPU needed):** copy the capdef to a temp file, append `alias _unpaired_test = _spirv_1_0;`,
run the prebuilt `build/generators/Debug/bin/slang-capability-generator <tmp> --target-directory <out> --doc <out>/doc.md`
→ 3× error 20007 but `echo $?` = 0 and all 4 output files written. Control (clean capdef) also exits 0.

**No exit-code test harness exists** for any tool under `tests/`/`tools/slang-unit-test/` — the regression test
is the tricky part; lightest lock is a `slang-unit-test` C++ test asserting `parseDefs()`→`SLANG_FAIL` +
`getErrorCount()>0` on an in-memory invalid capdef.

## Method lesson: verify tool-exit-code / control-flow claims against SOURCE, not DeepWiki
DeepWiki, asked how the generator sets its exit code, answered **incorrectly** that `main()` returns 1 on
validation failure. The actual source (and an empirical run) show it returns 0. When a claim is about concrete
control flow / return values / exit codes, DeepWiki's synthesized answer can be confidently wrong — read the
actual lines and, where a binary is available, run it. The maintainer's own code trace matched source; DeepWiki
did not.
