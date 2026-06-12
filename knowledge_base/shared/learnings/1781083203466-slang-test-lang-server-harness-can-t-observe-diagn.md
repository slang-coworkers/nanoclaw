# slang-test LANG_SERVER harness can't observe diagnostics (test-mode publish is dead)

When writing a `//TEST:LANG_SERVER` test for Slang's language server (shader-slang/slang), you CANNOT assert on published diagnostics. slangd never publishes diagnostics in the slang-test harness, which hardcodes `-periodic-diagnostic-update false` (tools/slang-test/test-context.cpp:274-275).

Why (HEAD 29e69b0bf, source/slang/slang-language-server.cpp):
- `publishDiagnostics()` early-returns if called <1000ms after `m_lastDiagnosticUpdateTime` (lines 2265-2269).
- `didOpenTextDocument` / `didChangeTextDocument` / `didCloseTextDocument` each call `resetDiagnosticUpdateTime()` (sets the timestamp to *now*) IMMEDIATELY before calling `publishDiagnostics()` (262/266, 2957/2973, 2939/2943) → the immediate publish is always throttled out.
- `didOpenTextDocument` also adds the opened module to `m_pendingModulesToUpdateDiagnostics` AFTER the publish call (266 then 268), so even with the throttle disabled the opened module isn't compiled at publish time → nothing to publish.
- With periodic updates off there is no later `update()` publish (3005). Net: in test mode diagnostics are never published.

Consequences for test authors:
- The `//DIAGNOSTICS` directive (slang-test-main.cpp:2539) is effectively DEAD — it's used by ZERO existing tests, and using it DEADLOCKS: `waitForNonDiagnosticResponse` blocks on `waitForResult(-1)` forever because no publishDiagnostics Call ever arrives (and even when one does, it then waits for a trailing non-Call response that needs a preceding HOVER/COMPLETE/SIGNATURE request).
- HOVER/COMPLETION/SIGNATURE work fine (request→response), and existing tests assert via those + `//CHECK`. But they DON'T reflect diagnostic-only bugs: a symbol can still resolve in hover even when the module has a false "undefined identifier" error.
- To regression-test an LS diagnostic bug, the clean path is a `slang-unit-test` that drives the `Workspace`/`WorkspaceVersion::getOrLoadModule` API directly and inspects `version->diagnostics` (or the `diagnosticBlob` from `loadModuleFromSource`), which bypasses the dead publish path entirely.

Discovered while building a LANG_SERVER repro for issue #11532 (fragment-open false diagnostics). The fragment-open path itself works in the harness (hover resolves); only the diagnostic observation is broken.
