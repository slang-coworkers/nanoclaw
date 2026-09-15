---
title: "Triaging slangd (language-server) crashes: drive LSP directly, and check the extension's bundled slang version"
type: learning
topic: slang-compiler
source: learnings/1789400009815-triaging-slangd-language-server-crashes-drive-lsp-.md
---

# Triaging slangd (language-server) crashes: drive LSP directly, and check the extension's bundled slang version

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789398913065-yrrtl6
written_at: 2026-09-14T15:33:29.815Z
---

# Triaging slangd (language-server) crashes: drive LSP directly, and check the extension's bundled slang version

From triaging slang-vscode-extension#77 (slangd Windows crash 0xC0000005 on `__file_decl` + in-function `groupshared`).

**1. `__file_decl` = `FileDecl`, and the VFX workspace flavor makes it pervasive.** `__file_decl` → `parseFileDecl` (`slang-parser.cpp:4635`) → `class FileDecl : public ContainerDecl` (`slang-ast-decl.h:854`), an ordinary *private*-scope container (its members are NOT spliced into module lookup; referencing one from outside → E30015). In the VFX workspace flavor (`.vfx` file or VFX-flagged workspace, `slang-workspace-version.cpp:776`), the macros `CS/VS/PS/GS/MS/RTX/PS_RTX/VS_RTX/VS_MS_RTX` are ALL `#define`d to `__file_decl` (`:782-790`). So Source2/VFX/Jinja-templated shader authors emit `__file_decl` blocks constantly — a normal user surface, not an exotic keyword.

**2. Batch `slangc` may NOT crash where `slangd` does.** A language-server crash lives on paths batch compile skips — semantic-tokens (syntax highlighting), documentSymbol, completion, hover, incremental didChange (mid-typing). To reproduce GPU-free, drive `slangd` directly with a tiny Python LSP client: spawn the binary, send `Content-Length: N\r\n\r\n<json>`-framed `initialize`/`initialized`/`textDocument/didOpen`, then request `semanticTokens/full`, `documentSymbol`, `completion`, `hover`; simulate typing with `didOpen`(stub)→`didChange`(full text). Detect crash via `proc.poll()` returning a negative signal / non-None exit. GOTCHA: don't call `proc.stderr.read()` at the end — it blocks until EOF (child holds the pipe) and hangs the driver until `timeout` kills it; drain stderr in a thread or use `stderr=DEVNULL`. Reusable driver pattern at /tmp/repro77/lsp_drive*.py.

**3. ALWAYS check which slang version the VSCode extension bundles before concluding.** The extension CHANGELOG at its release tag names it (e.g. v2.0.10 → "Update to Slang v2026.8"). A reported crash can easily be already-fixed in the gap between the bundled version and top-of-tree (here: ~4.5 months / ~9 minor versions). When a crash won't reproduce on TOT, the cheapest correct first action is *version-triage* — ask the reporter to update / override `slang.slangdLocation` to a current slangd — before spending on a code-level null-deref hunt or filing upstream. `0xC0000005` is Windows-only (access violation); a Linux Debug build may not surface a Windows-specific segfault.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789400009815-triaging-slangd-language-server-crashes-drive-lsp-.md`_
