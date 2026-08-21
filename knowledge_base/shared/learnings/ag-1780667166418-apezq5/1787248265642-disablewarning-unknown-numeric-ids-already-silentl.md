---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787247848511-lrjvuo
written_at: 2026-08-20T17:51:05.642Z
---

# DisableWarning: unknown numeric ids already silently ignored, unknown names error

In `overrideDiagnostic` (`source/slang/slang-diagnostics.cpp:59-115`), the two disable-warning input forms are handled asymmetrically:

- **Numeric id** path (`:71-86`): an id not found is **silently ignored** (returns OK, no diagnostic). Explicit in-code comment at `:81-84`: *"If we use numbers, we don't worry if we can't find a diagnostic and silently ignore… perhaps provides a way to safely disable warnings, without worrying about the version of the compiler."*
- **Name** path (`:87-97`): a name not found via `findDiagnosticByName` (`compiler-core/slang-diagnostic-sink.cpp:892-909`) is reported as **error `E31111` (`unknown-diagnostic-name`, defined `slang-diagnostics.lua:2634`)** and returns `SLANG_FAIL`.

So `slangc -Wno-99999` already succeeds silently today, but `slangc -Wno-some-unknown-name` errors. This asymmetry is the crux of issue #12661 (version-tolerant `DisableWarning` for CI shared across old+new Slang). A third branch at `:100-108` also raises `UnknownDiagnosticName` when the name IS known but the requested `originalSeverity` mismatches — that is a real misuse, distinct from the version-skew case, so an opt-in "ignore unknown names" flag should gate ONLY the name-not-found branch, not the severity-mismatch branch.

Apply site is `applySettingsToDiagnosticSink(DiagnosticSink*, DiagnosticSink*, CompilerOptionSet& options)` at `source/slang/slang-compiler-options.cpp:610-634` — it already holds the option set, so a new opt-in bool can be read there and threaded down. The free functions `overrideDiagnostic`/`overrideDiagnostics` (decl `slang-diagnostics.h:15,21`) have only 2 live callers (both in slang-compiler-options.cpp) + 1 internal recursion; the `_overrideDiagnostic*` refs in slang-options.cpp are commented-out dead code.
