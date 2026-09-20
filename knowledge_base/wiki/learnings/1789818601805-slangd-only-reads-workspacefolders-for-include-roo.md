---
title: "slangd only reads workspaceFolders for #include roots; testing the deprecated handshake via slang-test LANG_SERVER"
type: learning
topic: slang-compiler
source: learnings/1789818601805-slangd-only-reads-workspacefolders-for-include-roo.md
---

# slangd only reads workspaceFolders for #include roots; testing the deprecated handshake via slang-test LANG_SERVER

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789813938451-ono1sx
written_at: 2026-09-19T11:50:01.805Z
---

# slangd only reads workspaceFolders for #include roots; testing the deprecated handshake via slang-test LANG_SERVER

# slangd workspace-root handshake + LANG_SERVER test technique (from slang#13179)

## The bug class
slangd's search-path `#include` resolution depends on the workspace root scan. `LanguageServerCore::init`
(`source/slang/slang-language-server.cpp`) historically built roots ONLY from
`InitializeParams.workspaceFolders`. That struct (`source/compiler-core/slang-language-server-protocol.h`)
declared only `workspaceFolders`, and its RTTI ends with `ignoreUnknownFields()`, so `rootUri`, `rootPath`,
`initializationOptions`, and `capabilities` in the `initialize` request are silently DROPPED. A client that
announces its root only via the deprecated single-root `rootUri`/`rootPath` handshake (some non-VSCode
editors) therefore gives slangd NO roots → `Workspace::init`'s recursive scan (`slang-workspace-version.cpp`)
never runs → `workspaceSearchPaths` is empty → a search-path `#include` resolves only if the target's dir was
added by an OPEN doc (`Workspace::openDoc`). Fix: fall back to rootUri→rootPath when workspaceFolders is empty.

Note: `rootUri`/`rootPath` are `string|null` in LSP (VSCode sends `rootUri:null` alongside workspaceFolders);
the RTTI String reader turns JSON null into an empty string (`getTransientString`), so guard the fallback on
`getLength()` to avoid regressing existing clients.

## Config channels (all feed updateConfigFromJSON)
slangd reads settings from THREE channels: the server→client `workspace/configuration` PULL
(`sendConfigRequest`, issued in the `initialized` handler; reply read POSITIONALLY), the
`didChangeConfiguration` PUSH, and (after this fix) `initializationOptions`. `updateConfigFromJSON` accepts
FLAT dotted `slang.*` keys or a single `settings`/`RootElement` wrapper — NOT a nested `{"slang":{...}}`
object. Apply initializationOptions AFTER sending the InitializeResult (a handler can emit a server→client
refresh; those must follow the init response). And SNAPSHOT the object before iterating: `getObject()` returns
a view into `JSONContainer::m_objectValues`, and serializing an outbound refresh (`createObject`→`addRange`)
can reallocate that buffer and dangle the view mid-loop.

## Testing the deprecated handshake (the key technique)
slang-test has a `LANG_SERVER` test type (`runLanguageServerTest` in `tools/slang-test/slang-test-main.cpp`)
that SPAWNS the `slangd` executable and drives it over JSON-RPC, with `//COMPLETE`/`//HOVER`/`//SIGNATURE`/
`//DIAGNOSTICS` directives compared against `<test>.slang.expected.txt`. Two gotchas:
- It ALWAYS sent `workspaceFolders` and could not exercise rootUri/rootPath. I added `-init-root-uri` /
  `-init-root-path` args (read from `input.testOptions->args`) that send the single-root field with an EMPTY
  workspaceFolders — now the deprecated handshake is testable.
- It NEVER sends `initialized` and does NOT populate `initializationOptions`, so the config PULL and the
  initializationOptions channel are NOT exercised by slang-test (matches prior learning 1782172056258).
- Observe include resolution positively: `#include` a helper in a NEVER-OPENED subdir and `//HOVER` a symbol
  it defines. Resolved → hover shows the symbol; unresolved → the harness prints `null`. Use a
  `CONTAINS <symbol>` expected file to avoid pinning exact hover formatting. Output paths are redacted
  (`{REDACTED}.slang(line)`), so don't assert on absolute paths.
- Env note: FileCheck-dependent language-server tests are ignored when LLVM FileCheck isn't installed
  (~41 of them), so a clean run reports "N/N runnable passed, 41 ignored", not the full count.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789818601805-slangd-only-reads-workspacefolders-for-include-roo.md`_
