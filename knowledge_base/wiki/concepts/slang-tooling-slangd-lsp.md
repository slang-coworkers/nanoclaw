---
title: "Triaging slangd (language-server) crashes: version-triage, direct-LSP repro, and completion-mode modifier retention"
type: concept
group: slang-tooling
tags: [slangd, language-server, lsp, vscode-extension, completion-mode, triage, crash, groupshared, file-decl]
source_count: 6
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
- **Search-path `#include` resolution depends on the workspace-root handshake.** slangd builds its
  search dirs ONLY from `InitializeParams.workspaceFolders` (no `rootUri`/`rootPath` fallback,
  `initializationOptions` discarded via `ignoreUnknownFields()`), so a client that announces its root
  only via the deprecated single-root field gives slangd zero roots → a search-path include resolves
  only when the target file is already open. Suspect the handshake first for any "slangd doesn't see
  cross-file/include symbols" report.
- **Not every "highlighting breaks after editing" report is slangd.** In the C#/VSIX Visual Studio
  extension (`slang-vs-extension`, distinct from the VS *Code* extension and from slangd) the bug is
  almost always the extension's own semantic-token tagger, not the server — rebuilding with newer
  Slang libs will not fix it.

## Search-path #include resolution depends on the workspaceFolders handshake

Two atoms (near-duplicates, folded here) establish that slangd's non-relative / search-path `#include`
resolution depends on the LSP workspace-root scan, and that scan is fed **only** by
`InitializeParams.workspaceFolders`. `LanguageServerCore::init` (`slang-language-server.cpp:59-69`)
reads ONLY `args.workspaceFolders`; the `InitializeParams` struct declares only `workspaceFolders` and
ends its RTTI with `ignoreUnknownFields()`, so `rootUri`, `rootPath`, `initializationOptions`, and
`capabilities` in the `initialize` request are silently DROPPED. The search-directory list is (a) a
recursive disk scan of the `workspaceFolders` roots (`Workspace::init`,
`slang-workspace-version.cpp:167-206`, indexing the containing dir of every `.slang`/`.hlsl`, skipping
dot-dirs) plus (b) parent dirs of *open* documents (`Workspace::openDoc`). So a client that sends only
the deprecated `rootUri`/`rootPath` (some non-VSCode editors — the Zed report #13179) gives slangd
zero roots → search-path includes resolve only when the included file is opened directly, silently (no
diagnostic). The principled fix is at the producer: fall back rootUri→rootPath when workspaceFolders is
empty — guarded on `getLength()` because the RTTI String reader turns JSON `null` (VSCode sends
`rootUri:null`) into an empty string, so an unguarded fallback would regress existing clients
([search-path #include silently fails without workspaceFolders](../learnings/1789814011877-slangd-lsp-search-path-include-resolution-silently.md),
[slangd only reads workspaceFolders for #include roots + the LANG_SERVER test technique](../learnings/1789818601805-slangd-only-reads-workspacefolders-for-include-roo.md)).

Config-channel corollary (why "just set the setting" fails on non-VSCode editors): `additionalSearchPaths`/
`searchInAllWorkspaceDirectories` are read only via the server→client `workspace/configuration` **pull**
(15 dotted `slang.*` sections, reply read *positionally*, whole reply DROPPED if the array length ≠ 15)
or the `didChangeConfiguration` **push** — never from `initializationOptions`. `searchInAllWorkspaceDirectories`
is pull-only and already default-true, so toggling it is usually a no-op; slangd's config surface is
VSCode-pull-centric, and Zed/helix/neovim (which rely on `initializationOptions`) cannot configure it
today. `updateConfigFromJSON` accepts FLAT dotted `slang.*` keys or a single `settings`/`RootElement`
wrapper — NOT a nested `{"slang":{…}}` object; apply `initializationOptions` AFTER sending the
InitializeResult, and SNAPSHOT the object before iterating (`getObject()` is a view into
`JSONContainer::m_objectValues`, and serializing an outbound refresh can reallocate that buffer and
dangle the view).

### Testing the deprecated handshake and config channels via slang-test `LANG_SERVER`

slang-test's `LANG_SERVER` test type (`runLanguageServerTest`, `tools/slang-test/slang-test-main.cpp`)
SPAWNS `slangd` and drives it over JSON-RPC with `//COMPLETE`/`//HOVER`/`//SIGNATURE`/`//DIAGNOSTICS`
directives compared against `<test>.slang.expected.txt`. It ALWAYS sent `workspaceFolders`, so exercising
the deprecated handshake required adding `-init-root-uri`/`-init-root-path` args that send the single-root
field with an EMPTY `workspaceFolders`. Observe include resolution positively by `#include`-ing a helper in
a NEVER-OPENED subdir and `//HOVER`-ing a symbol it defines (resolved → hover shows the symbol; unresolved →
the harness prints `null`, or `--------\nnull`); use a `CONTAINS <symbol>` expected file since output paths
are redacted (`{REDACTED}.slang(line)`). The harness NEVER sends `initialized` and does not populate
`initializationOptions`, so the config PULL and the initializationOptions channel are NOT exercised by it.
**And do not try to test config ingestion by having the harness set `initializationOptions` at initialize:**
`updateConfigFromJSON`'s per-setting handlers call `sendRefreshRequests`/`workspace/*/refresh` (server→client
REQUESTS) when a value actually changes, but the harness's `waitForNonDiagnosticResponse` only drains
`publishDiagnostics` — any refresh is left in / mis-consumed from the stream, and because the harness reuses
ONE cached `slangd` process across all LANG_SERVER tests, the misaligned stream breaks not just that test
(empty hover: `--------` with no result) but the NEXT tests too. The workspace-root approach (A) IS cleanly
testable precisely because it needs no config change at init and emits no refresh
([the LANG_SERVER refresh-desync trap](../learnings/1789868223160-slang-test-lang-server-harness-desyncs-if-a-config.md)). FileCheck-dependent
language-server tests (~41) are ignored when LLVM FileCheck isn't installed, so a clean run reports
"N/N runnable passed, 41 ignored".

## "Stuck highlighting" in the VS (VSIX) extension is client-side, not slangd

When the report is against `slang-vs-extension` (the C#/VSIX Visual Studio extension — distinct from the
VS *Code* extension and from slangd), a "syntax highlighting breaks/gets stuck after editing" bug is almost
always the extension's own C# semantic-token tagger, not the language server. `SlangTokenHighlightTagger`
decodes cached LSP token deltas into absolute offsets against the *current* editor snapshot with no
snapshot-version stamp and no `TranslateTo`, so a multi-line cut/paste shifts the buffer while cached
tokens describe the old layout → mis-colored live text, and an offset overrun throws into
`catch { yield break; }` which silently kills the entire remaining tag enumeration (never recovers until a
fresh clean response lands). A dead debounce (`DateTime` compared `== null`, always false) fires an
unthrottled `semanticTokens/full` per edit, and out-of-order responses overwrite the cache with no version
check. The corrective worth stating up front: "rebuild with the latest Slang libraries / cut a new release"
will NOT fix this — the extension doesn't even pin a slangd version, and the defect is client-side C#;
non-reproducibility in vim/other LSP clients (which re-map/re-request tokens on didChange) is a positive
signal it's the VS extension's tagger. Fix direction: stamp each token set with its request snapshot version
and `TranslateTo`/re-map or discard-and-re-request on mismatch; replace `catch{yield break}` with a per-token
`continue` ([slang-vs-extension stale-highlight bugs are client-side, not slangd](../learnings/1789645330820-slang-vs-extension-stale-highlight-bugs-are-client.md)).

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

**Source learnings (6):**
- [Triaging slangd crashes: drive LSP directly, and check the extension's bundled slang version](../learnings/1789400009815-triaging-slangd-language-server-crashes-drive-lsp-.md) — `__file_decl`=`FileDecl` (pervasive in VFX flavor); batch slangc skips LSP-only paths; a Python LSP driver reproduces GPU-free (drain stderr in a thread); version-triage first; `0xC0000005` is Windows-only.
- [slangd Completion checking mode retains placement-illegal modifiers (ignoreUnallowedModifier)](../learnings/1789401281467-slangd-completion-checking-mode-retains-placement-.md) — `checkModifiers` sets `ignoreUnallowedModifier` in Completion mode → keeps a function-local `groupshared` slangc strips (E31201) → IR builds a rated function-local IRVar → consumers assume module-global → AV; stock slangd skips IR lowering so a plain LSP driver may not repro; fix at the producer.
- [slangd LSP: search-path #include resolution silently fails without workspaceFolders](../learnings/1789814011877-slangd-lsp-search-path-include-resolution-silently.md) — no rootUri/rootPath fallback; initializationOptions discarded; config is pull-only/positional; suspect the workspace-root handshake first.
- [slangd only reads workspaceFolders for #include roots; testing the deprecated handshake via LANG_SERVER](../learnings/1789818601805-slangd-only-reads-workspacefolders-for-include-roo.md) — fix = rootUri→rootPath fallback guarded on getLength(); added -init-root-uri/-init-root-path slang-test args; snapshot the config object before iterating.
- [slang-test LANG_SERVER harness desyncs if a config change emits a server→client refresh at initialize](../learnings/1789868223160-slang-test-lang-server-harness-desyncs-if-a-config.md) — the shared cached slangd process + a diagnostics-only drain leave a refresh in the stream, poisoning subsequent tests; the workspace-root path is cleanly testable because it emits no refresh.
- [slang-vs-extension stale-highlight bugs are client-side semantic-token cache/version mismatches, not slangd](../learnings/1789645330820-slang-vs-extension-stale-highlight-bugs-are-client.md) — the C#/VSIX tagger decodes cached tokens with no snapshot-version stamp; rebuilding with newer Slang libs won't fix it; non-repro in vim confirms it's the extension.

_Catalog: [[wiki/index.md]]_
