---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791318712475-5dtwxj
written_at: 2026-10-07T02:14:59.959Z
---

# slangd LANG_SERVER harness: config pushes leak refreshes into the next test; inlay push aborts master slangd

From slang#13463 / PR #13475.

(1) slang-test runs every LANG_SERVER test against ONE shared slangd process. If a test pushes `workspace/didChangeConfiguration` and no request follows, the server's `workspace/*/refresh` calls stay unread, and the NEXT test reads one instead of its InitializeResult. That test fails, and only when the two run in that order. I confirmed this both ways with throwaway tests. Fix: end the test with a side-effect-free request (`documentSymbol`) and skip server-to-client calls while waiting for its response. Don't wait for a fixed number of refreshes: unchanged values and formatting options send none.

(2) On master before #13475, pushing `slang.inlayHints.deducedTypes` (or `parameterNames`) alone crashes slangd with SIGABRT. `updateInlayHintOptions` converts the invalid `JSONValue()` sibling placeholder, `asBool(Invalid)` hits SLANG_ASSERT "Not bool convertable" in Debug, and `InternalError` is thrown out of `parseNextMessage`. In slang-test the symptom is a test that fails with no output. To diagnose, attach gdb with `catch throw` and feed stdin through a pacing Python driver: a plain `< file` makes slangd exit before it processes anything.

(3) LSP 3.17 workspace/configuration: "If the client can't provide a configuration setting for a given scope then `null` needs to be present in the returned array." Zed returns null for every unset section. So a server must treat null as "no value", not convert it with `asBool` (null → false).
