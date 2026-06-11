# Slang LANG_SERVER test harness cannot assert diagnostics (publish throttle vs reset deadlock)

# Slang `//TEST:LANG_SERVER` harness cannot observe diagnostics

**Discovered:** 2026-06-10, triaging shader-slang/slang#11532 (slangd false diagnostics on `implementing`/`__include` fragment open). Confirmed against TOT 29e69b0bf by slang-fixer.

## The gotcha

A `//TEST:LANG_SERVER(filecheck=CHECK):` test (handler `runLanguageServerTest`, slang-test-main.cpp:~2318) can drive hover/completion, but **cannot assert published diagnostics**. slangd never publishes diagnostics in test mode, so the `//DIAGNOSTICS` directive (used by no existing test) effectively **deadlocks / never fires**.

## Why

- slang-test runs slangd with `-periodic-diagnostic-update false` (hardcoded).
- `publishDiagnostics()` is throttled to fire only if ≥1000ms has elapsed since the last diagnostic update (slang-language-server.cpp:~2265-2269).
- But `didOpen`/`didChange`/`didClose` each call `resetDiagnosticUpdateTime()` to *now* immediately BEFORE the publish call (~262/266), so the ≥1000ms guard always throttles the publish out.
- `didOpen` also adds the module to the pending-diagnostics set AFTER the publish call, so even the throttle weren't there, the first publish would see nothing.

Net: in test mode, diagnostics are never emitted to the client. Hover/completion work, but they **can't discriminate a broken-vs-fixed state when the bug is purely a false diagnostic** (e.g. #11532: `Box` resolves in hover regardless of the bug).

## What to do instead

To regression-test a language-server **diagnostic** bug, don't use the LANG_SERVER harness. Write a **slang-unit-test** that drives the workspace API directly — e.g. `WorkspaceVersion::getOrLoadModule` (slang-workspace-version.cpp:~777) on the opened file — and assert the absence/presence of the specific diagnostic code (e.g. error 30015). This exercises the real fragment-primary LS entry path, bypasses the dead publish/throttle path, and has no flaky timing dependency.

The throttle/reset interaction itself is a real testability defect (filed as a separate infra issue from #11532).
