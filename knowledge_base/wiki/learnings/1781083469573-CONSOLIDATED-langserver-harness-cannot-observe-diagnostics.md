---
title: "CONSOLIDATED: Slang `//TEST:LANG_SERVER` harness cannot observe diagnostics (publish throttle vs reset deadlock)"
type: learning
topic: slang-compiler
source: learnings/1781083469573-CONSOLIDATED-langserver-harness-cannot-observe-diagnostics.md
---

# CONSOLIDATED: Slang `//TEST:LANG_SERVER` harness cannot observe diagnostics (publish throttle vs reset deadlock)

**Discovered 2026-06-10, triaging shader-slang/slang#11532 (slangd false diagnostics on `implementing`/`__include` fragment open). Confirmed against HEAD 29e69b0bf.**

A `//TEST:LANG_SERVER(filecheck=CHECK):` test (handler `runLanguageServerTest`, slang-test-main.cpp:~2318) can drive HOVER/COMPLETION/SIGNATURE (request→response), but **CANNOT assert published diagnostics** — slangd never publishes diagnostics in the slang-test harness. So the `//DIAGNOSTICS` directive (slang-test-main.cpp:~2539) is effectively DEAD (used by ZERO tests) and DEADLOCKS if used (`waitForNonDiagnosticResponse` blocks on `waitForResult(-1)` forever — no `publishDiagnostics` Call ever arrives).

**Why (source/slang/slang-language-server.cpp):**
- slang-test runs slangd with hardcoded `-periodic-diagnostic-update false` (tools/slang-test/test-context.cpp:274-275) → no later periodic `update()` publish.
- `publishDiagnostics()` early-returns if called <1000ms after `m_lastDiagnosticUpdateTime` (~2265-2269).
- `didOpen`/`didChange`/`didClose` each call `resetDiagnosticUpdateTime()` (sets timestamp to *now*) IMMEDIATELY before `publishDiagnostics()` → the immediate publish is always throttled out.
- `didOpen` also adds the module to `m_pendingModulesToUpdateDiagnostics` AFTER the publish call, so even with the throttle disabled there's nothing compiled to publish.

Net: in test mode diagnostics are never emitted to the client. HOVER/COMPLETION can't discriminate a broken-vs-fixed state when the bug is purely a false/missing diagnostic (e.g. #11532: a symbol resolves in hover even when the module has a false "undefined identifier" error). The throttle/reset interaction is itself a real testability defect (separately tracked, awaiting operator auth).

## What to do instead (regression-test an LS diagnostic bug)
- **A/B probe against real slangd** (control vs fix branch), comparing the actual published diagnostic set — how #11534-vs-#11532 was settled (control 4 diags → narrowed #11534 fix still 4 → broadened fix 0). This is verification, not a committable test.
- **Committable test:** a `slang-unit-test` that drives the workspace API directly — `WorkspaceVersion::getOrLoadModule` (slang-workspace-version.cpp:~777) on the opened file — and asserts presence/absence of the specific diagnostic code (e.g. error 30015 / 30015). Bypasses the dead publish path, no flaky timing.
- Do NOT promise a "GPU-free committable diagnostics regression test via `//TEST:LANG_SERVER`" — that claim was retracted (see `1781116005493`). The harness is fine for what it CAN observe (hover/completion/signature), just not diagnostic-publication assertions until the throttle-in-test-mode gap is fixed.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781083469573-CONSOLIDATED-langserver-harness-cannot-observe-diagnostics.md`_
