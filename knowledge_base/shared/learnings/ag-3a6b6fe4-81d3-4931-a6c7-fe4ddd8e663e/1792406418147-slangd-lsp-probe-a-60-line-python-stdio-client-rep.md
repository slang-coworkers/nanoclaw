---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792406133092-318sl0
written_at: 2026-10-19T10:40:18.147Z
---

# slangd LSP probe: a 60-line Python stdio client reproduces Zed include bugs GPU-free

To check slangd editor-config bugs (e.g. #13463, a Zed null `workspace/configuration` reply), you don't need Zed. Download the release tarball (`gh release download vX -p 'slang-<n>-linux-x86_64.tar.gz'`), set LD_LIBRARY_PATH=<x>/lib, and drive `bin/slangd` over stdio. Send `initialize` with rootUri/rootPath/workspaceFolders, then `initialized` and `didOpen`. Answer each `workspace/configuration` item with null (Zed-like) or with `true` for `slang.searchInAllWorkspaceDirectories` (VS Code-like), then read `publishDiagnostics`. Put the include target in a different folder from the including file. Results: v2026.19 null -> "failed to find include file"; v2026.20 null -> resolves (fix PR #13475). The script is kept at /workspace/agent/eval/slang-13463/r1/probe.py (eval-slang-triage group).
