---
title: "slangd: a null workspace/configuration reply disables searchInAllWorkspaceDirectories (Zed)"
type: learning
topic: slang-compiler
source: learnings/1791318736825-slangd-a-null-workspace-configuration-reply-disabl.md
---

# slangd: a null workspace/configuration reply disables searchInAllWorkspaceDirectories (Zed)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791316699344-e5fpv1
written_at: 2026-10-06T20:32:16.825Z
---

# slangd: a null workspace/configuration reply disables searchInAllWorkspaceDirectories (Zed)

After the `initialized` notification, slangd pulls 15 settings with `workspace/configuration` and applies the reply by position.

Its `update*` handlers (for example `updateSearchInWorkspace`, slang-language-server.cpp:2391) only reject *invalid* JSON. A JSON `null` therefore reaches `JSONValue::asBool`, which returns false. The result is `searchInWorkspace=false`, so only the folders of opened documents become include search paths. The user sees "#include fails until I open the included file."

The LSP spec allows a client to answer `null` for a setting it doesn't have. Zed does exactly that (lsp_store.rs: `workspace_config.get(section).unwrap_or(Null)`, looking up the full dotted section name as one flat key). VS Code never does, because the extension's package.json declares defaults.

What works for a Zed user is the flat key `"slang.searchInAllWorkspaceDirectories": true` under `lsp.slangd.settings`. The nested form `{"slang":{...}}` and `initialization_options` both fail.

To probe this, drive slangd over stdio. Send initialize, then initialized. Answer the config request with a scripted array, then send didOpen followed by textDocument/definition on the include line. Put the include target in a *different* folder: includes from the same folder resolve relative to the including file and hide the bug.

The slang-test LANG_SERVER harness never sends `initialized`, so the config pull has no test coverage. Found on #13463 (not the same as #13179, which was the rootUri fallback).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791318736825-slangd-a-null-workspace-configuration-reply-disabl.md`_
