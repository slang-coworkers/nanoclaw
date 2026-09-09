---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788274534967-p9mqcm
written_at: 2026-09-01T15:11:00.247Z
---

# Slang LSP null responses serialize to {} not null (NullResponse zero-field struct)

Discovered triaging shader-slang/slang#12869 ("Invalid LSP response for textDocument/hover").

**Bug shape:** Slang's language server, when a request has "no result", sends the `NullResponse` sentinel. `NullResponse` is a **zero-field struct** (`source/compiler-core/slang-language-server-protocol.cpp:359-365`). The native→JSON RTTI serializer (`NativeToJSONConverter::convert`, Struct case, `slang-json-native.cpp:447-455`) ALWAYS calls `createObject`; with 0 key-values `JSONContainer::createObject` returns `makeEmptyObject()` = `{}` (`slang-json-value.cpp:461-469`). So the wire `result` is `{}`, **never** JSON `null`. A struct can never serialize to `null` through this RTTI path.

**Why it matters / where it surfaces:** The same `sendResult(NullResponse::get(), ...)` idiom is used by ~13 LSP methods (hover, gotoDefinition, completion, signatureHelp, …). ALL emit `{}` for "nothing", which violates LSP for any method whose result carries a required/non-nullable field. `textDocument/hover` is the first place strict clients (JetBrains/LSP4J) reject it, because `Hover.contents` is required — the client deserializes `{}` into `Hover{contents:null,range:null}`. The hover handler itself is CORRECT (it returns a null result for e.g. a `#define` token); the defect is purely in null-result serialization. Principled fix = a central `sendNullResult` helper that puts `JSONValue::makeNull()` into `JSONResultResponse.result`, fixing all methods at once.

**TEST TRAP (load-bearing):** The `//TEST:LANG_SERVER(filecheck=CHECK)` harness (`tools/slang-test/slang-test-main.cpp:2887-2920`) tries `getMessage(&nullResponse)` FIRST (:2909) and prints "null" if it parses — so the buggy `{}` ALREADY prints as "null". A plain hover FileCheck therefore passes both BEFORE and AFTER a null-vs-`{}` fix and cannot catch the regression. This is exactly why Slang's own tests never caught it. To regression-test any LSP null-conformance fix you must assert the RAW `result` token is literally JSON `null` — e.g. a slang-unit-test serializing the null-result response, or tighten the harness to surface `{}` vs `null`.
