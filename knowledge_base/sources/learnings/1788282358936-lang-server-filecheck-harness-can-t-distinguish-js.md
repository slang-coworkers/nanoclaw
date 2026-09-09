---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788275298714-r5q6l2
written_at: 2026-09-01T17:05:58.936Z
---

# LANG_SERVER FileCheck harness can't distinguish JSON {} from null (slang LSP)

**Context:** shader-slang/slang#12869 — LSP `textDocument/hover` (and 12 sibling methods) sent an empty result as JSON `{}` instead of `null`, which strict clients (JetBrains/LSP4J) reject because `Hover.contents` is required/non-nullable.

**Root cause (reusable):** the "no result" idiom `sendResult(NullResponse::get(), id)` serializes a **zero-field struct** through the RTTI `NativeToJSONConverter`, whose Struct case always builds an object → `makeEmptyObject()` → `{}`. A struct can NEVER serialize to JSON `null` via that path. Fix = a dedicated `JSONRPCConnection::sendNullResult(id)` that sets `response.result = JSONValue::makeNull()` and route every no-result site through it; then the `NullResponse` struct is dead → delete it (removes the `{}`-emitting footgun).

**The non-obvious testing trap (this is the time-saver):** the `//TEST:LANG_SERVER` FileCheck harness in `tools/slang-test/slang-test-main.cpp` detected "null" via `getMessage(&NullResponse)`. Two facts make this a trap:
1. `getMessage` into a **zero-field struct succeeds on `{}`** (empty object → 0 fields) → prints "null". So the buggy `{}` already printed "null" — a naive hover FileCheck for `null` passes BOTH before and after any fix. This is why the bug hid from CI for years.
2. JSON→native **Struct conversion FAILS on a JSON `null` source** (`slang-json-native.cpp` Struct case: `if (in.getKind() != JSONValue::Kind::Object) return SLANG_FAIL`). So once you fix the serializer to emit real `null`, the OLD harness's `getMessage(&NullResponse)` FAILS → prints nothing → **silently breaks every existing null-hover/completion/signature test**.

**Correct way to test raw wire JSON:** read `connection->getRPC(&JSONResultResponse)` and inspect `resultResponse.result.getKind() == JSONValue::Kind::Null` — this reads the raw `result` `JSONValue` without forcing it through a struct, so it faithfully distinguishes `null` from `{}`. `getRPC` and `getMessage` both read the cached `m_jsonRoot` without consuming it, so a `getRPC`-then-`getMessage` else-branch is safe. Extract the check into one named predicate (`receivedNullResult(connection)`) so a future "simplify" back to `getMessage` can't reinstate the bug.

**Harness detail:** `//TEST:LANG_SERVER` spawns the real `slangd` executable (`TestContext::createLanguageServerJSONRPCConnection`, `test-context.cpp`) over stdio — it is NOT in-process. Positions are `//HOVER:line,col` (1-based, points at an absolute document line). Hovering inside the `#define` keyword reliably yields a null result.
