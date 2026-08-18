---
title: "Verifying slangd LSP-config settings: probe must answer the workspace/configuration pull"
type: learning
topic: verification
source: learnings/1782172056258-verifying-slangd-lsp-config-settings-probe-must-an.md
---

# Verifying slangd LSP-config settings: probe must answer the workspace/configuration pull

When a slangd (Slang language server) feature is driven by a client setting (e.g. `slang.predefinedLanguageVersion`, `slang.workspaceFlavor`), the in-tree `slang-test` harness does NOT exercise the LSP `workspace/configuration` pull — so there is no committable `.slang` directive that asserts the behavior. Verify with an LSP stdio probe instead, and disclose "no committable regression test" in the PR (codex accepts this when the gap is named).

**Probe technique:** slangd calls `sendConfigRequest()` once at init (before any document opens), sending a server→client `workspace/configuration` request with an index-positional `items` array. Your probe's reader thread must detect `method=="workspace/configuration"` with an `id`, and reply `{"id":<id>,"result":[...]}` with one element per requested section (order = the `item.section=` sequence in `sendConfigRequest`; null for sections you don't care about — the update* fns guard on `isValid`). Then `sleep ~1s`, send `didOpen`, collect `publishDiagnostics`. Working harness: `/workspace/agent/expt-vscode-ext-70/probe_langver.py`. Good A/B signal for language-version: empty-tuple `()` → error 20005 below 2026, clean at ≥2026.

**slangd-internals gotcha codex caught:** `slang.workspaceFlavor` is NOT applied via `SessionDesc` — it's stored on a `Workspace` field and consumed later in `WorkspaceVersion::ensureWorkspaceFlavor()` by mutating `linkage->m_optionSet` + preprocessor defines. Only the *config-pull→Workspace-field* plumbing is shared across settings; the *application* differs per setting (SessionDesc compiler-option injection in createWorkspaceVersion is one valid path, used for the language-version setting). Don't claim a new setting "mirrors workspaceFlavor → SessionDesc."

**Mid-session refresh:** for a setting users realistically toggle while a file is open, follow the `updatePredefinedMacros`/`updateSearchPaths` pattern (a `Workspace::updateX()→bool` that sets+`invalidate()` on change; LS caller does `sendRefreshRequests(m_connection)` when true) — `invalidate()` is just `currentVersion=nullptr`. The lighter `workspaceFlavor` (store field only, no refresh) leaves stale diagnostics until an unrelated edit.

clang-format isn't preinstalled in this container; `pip install --break-system-packages clang-format==18.1.8` puts it in `~/.local/bin` (17-18 is the required range). git worktrees may lack the `origin/<branch>` tracking ref, breaking bare `--force-with-lease`; use `git ls-remote origin <branch>` to get the SHA then `--force-with-lease=refs/heads/<branch>:<sha>`.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782172056258-verifying-slangd-lsp-config-settings-probe-must-an.md`_
