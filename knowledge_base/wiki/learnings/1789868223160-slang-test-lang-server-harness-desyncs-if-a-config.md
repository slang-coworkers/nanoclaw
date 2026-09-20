---
title: "slang-test LANG_SERVER harness desyncs if a config change emits a server→client refresh at initialize"
type: learning
topic: slang-compiler
source: learnings/1789868223160-slang-test-lang-server-harness-desyncs-if-a-config.md
---

# slang-test LANG_SERVER harness desyncs if a config change emits a server→client refresh at initialize

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789813938451-ono1sx
written_at: 2026-09-20T01:37:03.160Z
---

# slang-test LANG_SERVER harness desyncs if a config change emits a server→client refresh at initialize

# Testing slangd config channels via LANG_SERVER: the refresh-desync trap

When adding regression coverage for slangd config ingestion (initializationOptions, or the
`workspace/configuration` pull), you will be tempted to have `runLanguageServerTest`
(`tools/slang-test/slang-test-main.cpp`) set `initParams.initializationOptions` to a `slang.*`
setting and assert an observable effect (e.g. `searchInAllWorkspaceDirectories=false` → a subdir
`#include` stops resolving → hover `null`). **This desyncs the shared slangd connection and poisons
subsequent tests.**

Mechanism: slangd applies initializationOptions through `updateConfigFromJSON`, whose per-setting
handlers call `sendRefreshRequests(...)` / `sendCall("workspace/*/refresh")` **when a value
actually changes**. Those are server→client REQUESTS. The harness's `waitForNonDiagnosticResponse`
lambda only drains `textDocument/publishDiagnostics`; any other server→client Call (a refresh) is
left in / mis-consumed from the stream. Because the harness reuses ONE spawned `slangd` process
across all LANG_SERVER tests (`context->m_languageServerConnection` is cached), the misaligned
message stream breaks not just that test (hover comes back empty, `--------` with no result) but the
NEXT tests too (observed: unrelated variants failing only when run in-suite after the offending
test).

Consequences / options if you must test config:
- You cannot simply defer applying initializationOptions to the `initialized` handler to avoid the
  init-time refresh: the harness never sends `initialized`, and the RPC container is reset per
  received message (`JSONRPCConnection::clearBuffers()` resets `m_container` before parsing each
  message), so a stashed `args.initializationOptions` from the `initialize` message dangles later.
- To make config channels committable you'd have to extend the harness to (a) send `initialized`
  and (b) detect + respond to server→client requests (refresh etc.) so the stream stays aligned.
  That's real harness work, not a one-liner.
- Approach A (workspace-root handshake → `#include` resolution) IS cleanly testable because it needs
  no config change at init and emits no refresh; use `-init-root-uri`/`-init-root-path` args
  (empty workspaceFolders) + a subdir include + HOVER, asserting resolved-vs-`null`.

Context: shader-slang/slang#13179 / PR #13182. An unresolved-symbol hover deterministically prints
`--------\nnull`; a desynced/empty hover prints just `--------`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789868223160-slang-test-lang-server-harness-desyncs-if-a-config.md`_
