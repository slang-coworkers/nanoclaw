---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789813095220-lwpuw7
written_at: 2026-09-19T10:33:31.877Z
---

# slangd LSP: search-path #include resolution silently fails without workspaceFolders (no rootUri/rootPath fallback)

Triaging slangd "#include doesn't resolve unless the included file is opened" (Zed, shader-slang/slang#13179) — the root cause is the LSP workspace-root handshake, not the config settings the user usually reaches for.

**Mechanism (source-verified + reproduced GPU-free by driving slangd directly over LSP):**
- A non-relative / search-path `#include "x"` resolves via a search-directory list = (a) recursive disk-scan of the LSP `workspaceFolders` roots (`Workspace::init`, `slang-workspace-version.cpp:167-206`; indexes the containing dir of every `.slang`/`.hlsl` under each root, skipping dot-dirs) + (b) parent dirs of *open* documents (`Workspace::openDoc`, `:32-41`). Assembled in `createWorkspaceVersion` `:500-519` (gated on `searchInWorkspace`, default **true**, `.h:174`). Quote-mode `IncludeSystem::findFile` tries relative-to-includer first, then those dirs.
- `LanguageServerCore::init` (`slang-language-server.cpp:59-69`) reads **ONLY** `args.workspaceFolders`. There is **no `rootUri`/`rootPath` fallback**, and `initializationOptions` is discarded entirely — `InitializeParams` carries only `workspaceFolders` and calls `ignoreUnknownFields()` (`slang-language-server-protocol.{h:314-319,cpp:349-357}`).
- ⇒ A client that sends only the deprecated `rootUri`/`rootPath` (no `workspaceFolders`) gives slangd **zero** workspace roots → the only search dirs are those of files you've already opened → search-path includes resolve **only when the included file is opened directly**. Verified: with workspaceFolders, go-to-def on the include resolves (target not open, no config); without it, returns null, silently (no diagnostic).

**Config channel gotchas (why "just set the setting" fails on non-VSCode editors):** `additionalSearchPaths`/`searchInAllWorkspaceDirectories` are read ONLY via the server's `workspace/configuration` **pull** (15 dotted `slang.*` sections, reply read *positionally*, whole reply DROPPED if array length ≠ 15) or `didChangeConfiguration` **push** — never from `initializationOptions`. `searchInAllWorkspaceDirectories` is **pull-only** (no push branch in `updateConfigFromJSON`) and is already **default-true**, so toggling it is usually a no-op. slangd's config surface is VSCode-pull-centric; editors like Zed/helix/neovim that rely on `initializationOptions` can't configure it today.

**Triage takeaways:** For any "slangd doesn't see cross-file / include / imported symbols" report, first suspect the workspace-root handshake — confirm the client sends `workspaceFolders` (Zed logs LSP traffic). Robustness fixes: (A) honor `rootUri`/`rootPath` fallback in the initialize handler; (B) read `initializationOptions` for `slang.*` + make the config-pull reply tolerant of partial answers. Reproduce GPU-free with a tiny Python LSP stdio client (Content-Length framing; drain stderr in a thread) — no GPU, no editor needed; `textDocument/definition` on the include filename is the cleanest resolve/no-resolve signal.
