---
title: "Slang diagnostic-callback API: legacy + severity-less; diagnostics roadmap is the Rich Diagnostics rewrite"
type: learning
topic: slang-compiler
source: learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md
---

# Slang diagnostic-callback API: legacy + severity-less; diagnostics roadmap is the Rich Diagnostics rewrite

Triaging slang#8822 (request for a severity-aware diagnostic callback). Facts worth reusing for any diagnostics-API triage (HEAD a39e49c28):

**A diagnostic callback ALREADY exists but satisfies almost nothing modern callers want:**
- `SlangDiagnosticCallback` — `include/slang.h:1942` — `typedef void (*)(char const* message, void* userData)`. Message + userData only, **NO severity**.
- Exposed ONLY on the legacy path: `ICompileRequest::setDiagnosticCallback` (`slang.h:1207`) and deprecated `spSetDiagnosticCallback` (`slang-deprecated.h:168`). NOT on `IGlobalSession`/`ISession`/`IModule`.
- Wiring: `slang-end-to-end-request.cpp:1313-1322` wraps it in a `CallbackWriter` (`slang-writer.h:109-126`) installed as the Diagnostic *writer channel* → receives already-formatted text (severity baked into the string).
- The modern `ISession::loadModule` / `IComponentType` path returns diagnostics ONLY via `IBlob** outDiagnostics` (~37 such methods in `slang.h`); no callback hook reaches it.

**Severity IS available internally — only flattened at the public boundary:**
- Per-message severity on `DiagnosticInfo::severity` / `Diagnostic::severity`; read at emit time in `diagnoseImpl`/`diagnoseRichImpl` (`source/compiler-core/slang-diagnostic-sink.cpp:600`/`641`). Public `SlangSeverity` (`slang.h:576-583`) maps 1:1 to internal `enum class Severity` (`slang-diagnostic-sink.h:13-31`).
- Blob is built only from the rendered `outputBuffer` via `getBlobIfNeeded()` → `StringUtil::createStringBlob` (`:574-594`). **Writer-mode and blob-mode are mutually exclusive** — `getBlobIfNeeded` asserts `writer==nullptr` (`:582`). So any severity callback must be a *parallel per-message observer on the sink*, NOT the writer channel, or the blob stops populating.

**Roadmap context (shapes the next-step verdict for ALL diagnostics-API feature requests):**
- Diagnostics super-issue **#9140** → the maintainer direction is the **"Rich Diagnostics" rewrite** (prototype #9129, conversion #9535), after which the **old diagnostic system is removed (#9726)** and users migrated (#9727). A standalone bolt-on built on today's system risks being reworked.
- Sibling structured-output proposal **#9123 "JSON output format" was closed NOT_PLANNED** (2026-06-04, expipiplus1). Signals low appetite for a second parallel structured-output surface — new diagnostics-API features are **maintainer-design-gated**, not auto-implementable.

**ABI note:** replacing the existing `IBlob** outDiagnostic` params (the reporter's literal "preferred" form) is a wholesale ABI/source break — non-viable. Any fix must be additive (new typedef + appended COM setter = 5 ABI touchpoints).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md`_
