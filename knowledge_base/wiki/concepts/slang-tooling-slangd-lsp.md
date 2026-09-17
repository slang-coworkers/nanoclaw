---
title: "Triaging slangd (language-server) crashes: version-triage, direct-LSP repro, and completion-mode modifier retention"
type: concept
group: slang-tooling
tags: [slangd, language-server, lsp, vscode-extension, completion-mode, triage, crash, groupshared, file-decl]
source_count: 2
---

## TL;DR

A slangd crash lives on paths batch `slangc` never touches (semantic tokens, completion, hover,
mid-typing `didChange`), so it needs its own reproduction and triage discipline — and a whole class
of these are self-inflicted by Completion checking mode deliberately keeping modifiers the general
checker strips.

- **Version-triage first.** The VSCode extension bundles a pinned slang (its CHANGELOG at the release
  tag names it, e.g. v2.0.10 → "Slang v2026.8"); a reported crash is often already fixed in the gap
  to top-of-tree. The cheapest correct first action is asking the reporter to update / override
  `slang.slangdLocation`, before any null-deref hunt. `0xC0000005` is Windows-only (access violation)
  — a Linux Debug build may not surface it.
- **Reproduce GPU-free by driving `slangd` directly** with a tiny Python LSP client (`Content-Length`
  framing → `initialize`/`initialized`/`didOpen` → `semanticTokens/full`, `documentSymbol`,
  `completion`, `hover`; simulate typing with `didOpen`(stub)→`didChange`(full text)). Detect a crash
  via `proc.poll()` returning a negative signal / non-None exit. Never `proc.stderr.read()` at the end
  — it blocks until EOF; drain stderr in a thread or use `stderr=DEVNULL`.
- **Batch `slangc` may not crash where slangd does**, and a crash that vanishes when one modifier is
  removed is the tell: Completion checking mode retains placement-illegal modifiers the general
  checker would strip.
- **Stock slangd does NOT lower to IR** (`loadParsedModule` skips it under `isInLanguageServer()`), so
  an IR-lowering deref fires only if the crashing config actually compiles (e.g. a VFX-flavor real
  compile) — a non-repro via a plain LSP driver does not mean "not a bug."

## Version-triage before code-level hunting

The VSCode extension ships a bundled slang, and the extension CHANGELOG at its release tag names the
version (e.g. v2.0.10 → "Update to Slang v2026.8"). A reported crash can easily already be fixed in
the gap between the bundled version and top-of-tree — on slang-vscode-extension#77 that gap was ~4.5
months / ~9 minor versions. So when a crash will not reproduce on TOT, the cheapest correct first
action is *version-triage*: ask the reporter to update or override `slang.slangdLocation` to a current
slangd, before spending on a code-level null-deref hunt or filing upstream. Note the platform coupling:
`0xC0000005` is a Windows access violation, so a Linux Debug build may never surface a Windows-specific
segfault [drive LSP directly, check the bundled version](../learnings/1789400009815-triaging-slangd-language-server-crashes-drive-lsp-.md).

## Reproducing a slangd-only crash without a GPU

A language-server crash lives on paths batch compile skips — semantic tokens (syntax highlighting),
`documentSymbol`, completion, hover, and incremental `didChange` (mid-typing). To reproduce it
GPU-free, drive the `slangd` binary directly with a small Python LSP client: spawn the binary, send
`Content-Length: N\r\n\r\n<json>`-framed `initialize`/`initialized`/`textDocument/didOpen`, then
request `semanticTokens/full`, `documentSymbol`, `completion`, `hover`; simulate typing with a
`didOpen`(stub) followed by a full-text `didChange`. Detect a crash by `proc.poll()` returning a
negative signal or a non-None exit. Gotcha: do **not** call `proc.stderr.read()` at the end — it
blocks until EOF (the child still holds the pipe) and hangs the driver until `timeout` kills it; drain
stderr in a thread or use `stderr=DEVNULL` [drive LSP directly, check the bundled version](../learnings/1789400009815-triaging-slangd-language-server-crashes-drive-lsp-.md).

One input surface worth knowing during triage: `__file_decl` parses to `FileDecl`
(`parseFileDecl`, `slang-parser.cpp:4635` → `class FileDecl : public ContainerDecl`,
`slang-ast-decl.h:854`), an ordinary *private*-scope container whose members are not spliced into
module lookup (referencing one from outside → E30015). In the VFX workspace flavor (a `.vfx` file or
VFX-flagged workspace, `slang-workspace-version.cpp:776`), the macros `CS/VS/PS/GS/MS/RTX/PS_RTX/
VS_RTX/VS_MS_RTX` are ALL `#define`d to `__file_decl` (`:782-790`), so Source2/VFX/Jinja-templated
shader authors emit `__file_decl` blocks constantly — a normal user surface, not an exotic keyword.

## Why crashes are slangd-only: Completion mode retains placement-illegal modifiers

A whole class of slangd-only front-end crashes comes from **Completion checking mode deliberately
keeping modifiers the general checker would strip**. In `SemanticsVisitor::checkModifiers`
(`source/slang/slang-check-modifier.cpp:2507-2509`), when
`getLinkage()->contentAssistInfo.checkingMode == ContentAssistCheckingMode::Completion`, it sets
`ignoreUnallowedModifier = true`. That flag makes `checkModifier` (`:1975-1982`) take the `return m;`
branch instead of `diagnose(ModifierNotAllowed); return nullptr;` — it retains a modifier that
`isModifierAllowedOnDecl` rejects, with NO diagnostic. The intent is to avoid spurious diagnostics
while the user is mid-typing, but it is *blanket* leniency: it also keeps modifiers rejected for hard
*placement* reasons, manufacturing AST shapes no downstream stage models
[completion mode retains placement-illegal modifiers](../learnings/1789401281467-slangd-completion-checking-mode-retains-placement-.md).

Concretely: a `groupshared` on a function-local (`isModifierAllowedOnDecl` = `isGlobalDecl ||
isEffectivelyStatic`, both false for a `ScopeDecl` parent) is stripped by slangc/general mode
(→ E31201, no crash) but RETAINED by slangd in completion mode. That manufactures a "function-local
groupshared" — a shape no downstream stage models. If the config then lowers to IR,
`maybeSetRate`/`createVar` (`slang-lower-to-ir.cpp:3317-3348`) build a GroupShared-rated
function-local `IRVar`, and groupshared consumers (`slang-ir-explicit-global-context.cpp`,
`slang-ir-glsl-legalize.cpp`, `slang-ir-typeflow-specialize.cpp`) assume module-global → an unguarded
null-deref / access violation.

Triage implications:

- This is why a crash can be slangd-only (never slangc) AND disappear when one modifier is removed —
  the general checker strips it, completion mode keeps it.
- **Stock slangd does NOT lower to IR** (`loadParsedModule` skips it when `isInLanguageServer()`,
  `slang-session.cpp:1149-1155`), so an IR-lowering deref only fires if the crashing config actually
  compiles (e.g. a VFX-flavor real compile). This is why such a crash may NOT reproduce via a plain
  LSP `didOpen`+`semanticTokens`+`completion` driver even though the retained-modifier root cause is
  present — don't conclude "not a bug" from a non-repro; verify the modifier-retention path.
- The principled fix is at the producer (`checkModifier`): narrow the completion-mode exception so
  placement-illegal modifiers (which build shapes no stage models) are still stripped, rather than
  guarding every downstream consumer.

**Source learnings (2):**
- [Triaging slangd crashes: drive LSP directly, and check the extension's bundled slang version](../learnings/1789400009815-triaging-slangd-language-server-crashes-drive-lsp-.md) — `__file_decl`=`FileDecl` (pervasive in VFX flavor); batch slangc skips LSP-only paths; a Python LSP driver reproduces GPU-free (drain stderr in a thread); version-triage first; `0xC0000005` is Windows-only.
- [slangd Completion checking mode retains placement-illegal modifiers (ignoreUnallowedModifier)](../learnings/1789401281467-slangd-completion-checking-mode-retains-placement-.md) — `checkModifiers` sets `ignoreUnallowedModifier` in Completion mode → keeps a function-local `groupshared` slangc strips (E31201) → IR builds a rated function-local IRVar → consumers assume module-global → AV; stock slangd skips IR lowering so a plain LSP driver may not repro; fix at the producer.

_Catalog: [[wiki/index.md]]_
