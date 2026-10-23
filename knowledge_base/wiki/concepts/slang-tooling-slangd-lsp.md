---
title: "Triaging slangd (language-server) crashes: version-triage, direct-LSP repro, and completion-mode modifier retention"
type: concept
group: slang-tooling
tags: [slangd, language-server, lsp, vscode-extension, completion-mode, triage, crash, groupshared, file-decl]
source_count: 16
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
- **Reproduce GPU-free by driving `slangd` directly** (a release tarball + `LD_LIBRARY_PATH` is
  enough) with a tiny Python LSP client: `initialize`/`initialized`/`didOpen`, then the requests
  under test. Detect a crash via `proc.poll()`; drain stderr in a thread, never `stderr.read()` at the end.
- **Check a Release-verified LSP test on Debug too** (CI runs Debug): a debug-only `SLANG_ASSERT` can
  abort the module load so hover returns `null`. `SLANG_ASSERT=release-assert-only` replays the
  Release path on a Debug binary; a `{{null|expected}}` CHECK passes in both and still fails on a crash.
- **Batch `slangc` may not crash where slangd does**, for two reasons: Completion checking mode retains
  placement-illegal modifiers the general checker would strip (a crash that vanishes when one modifier
  is removed is the tell), and slangd keeps semantic-checking after parse errors that stop slangc. Probe
  invalid-input paths through slangd itself, with a plain-input control on the same binary.
- **Stock slangd does NOT lower to IR** (`loadParsedModule` skips it under `isInLanguageServer()`), so
  an IR-lowering deref fires only if the crashing config actually compiles (e.g. a VFX-flavor real
  compile) — a non-repro via a plain LSP driver does not mean "not a bug."
- **Search-path `#include` resolution depends on the workspace-root handshake.** Before #13192
  (merged 2026-09-23) slangd built its search dirs ONLY from `InitializeParams.workspaceFolders` (no
  `rootUri`/`rootPath` fallback; `initializationOptions` is discarded via `ignoreUnknownFields()`), so a client that announces its root
  only via the deprecated single-root field gives slangd zero roots → a search-path include resolves
  only when the target file is already open. Suspect the handshake first; test a list-valued fix with
  two or more entries (#13192 also had to stop each root overwriting the previous root's paths).
- **For an include/config probe, the pass signal is `textDocument/definition`, not diagnostics.** A
  resolved include may send no `publishDiagnostics` in the window; definition is `null` on failure.
- **A JSON `null` config reply silently turns a setting OFF** (Zed answers null for every unset
  section; `asBool(null)` → false), and because slang-test runs every `LANG_SERVER` test against ONE
  shared slangd, a config change whose `workspace/*/refresh` calls go unread poisons the NEXT test —
  end it with a side-effect-free request barrier and read `failed(pending retry)` lines.
- **slangd cannot import `slang.numerics` and the other `[ExperimentalModule]` std modules (E00104):** it has no
  way to set `ExperimentalFeature`, and the VSIX packages ship no `slang-standard-module-<ver>/` directory.
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

The merged fix for #13179 is #13192 (merged 2026-09-23 as `94d6c57e33`), not our draft #13182. Both add the
`rootUri`/`rootPath` fallback, but #13192 also fixes a second root cause that we missed: `Workspace::init`
`_Move`-overwrote `workspaceSearchPaths` for each root, so only the last root's paths survived. #13192
accumulates every root's paths into a deduplicated `OrderedHashSet`, first root first. It has a
handshake test for each field (`root-uri-only`, `root-path-only`, `multi-root`) and a `search-path-order/`
suite. Rule: when a fix adds a fallback source for a list-valued input (roots, search paths, include
dirs), test with two or more entries and check the output order; a one-entry test cannot catch a
per-item overwrite. A separate crash still reproduces at master `9e17a9e850` and is filed as #13757: an
array `settings` in `didChangeConfiguration` passes `isObjectLike()` (true for arrays), and then the
`getObject()` assert throws ([postmortem: #13179 superseded by #13192 — per-root overwrite; test N≥2 roots and their order](../learnings/1792461389590-postmortem-shader-slang-slang-13179-superseded-by-.md)).

Config-channel corollary (why "just set the setting" fails on non-VSCode editors): `additionalSearchPaths`/
`searchInAllWorkspaceDirectories` are read only via the server→client `workspace/configuration` **pull**
(15 dotted `slang.*` sections, reply read *positionally*, whole reply DROPPED if the array length ≠ 15)
or the `didChangeConfiguration` **push** — never from `initializationOptions`. `searchInAllWorkspaceDirectories`
is pull-only and already default-true — but only when the client supplies a value: a `null` reply turns
it off (next section). slangd's config surface is VSCode-pull-centric; editors that rely on
`initializationOptions` cannot reach it, and a Zed user must put the FLAT key
`"slang.searchInAllWorkspaceDirectories": true` under `lsp.slangd.settings` (nested `{"slang":{…}}` and
`initialization_options` both fail). `updateConfigFromJSON` accepts FLAT dotted `slang.*` keys or a single `settings`/`RootElement`
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

### Null config replies, and the refresh-leak barrier (#13463 / PR #13475)

After `initialized`, slangd pulls its 15 settings with `workspace/configuration` and applies the reply by
position. The `update*` handlers (e.g. `updateSearchInWorkspace`, `slang-language-server.cpp:2391`) reject
only *invalid* JSON, so a JSON `null` reaches `JSONValue::asBool` and becomes `false`. LSP 3.17 requires
the client to put `null` in the array for any setting it cannot provide, and Zed does exactly that
(`workspace_config.get(section).unwrap_or(Null)`, looking the full dotted name up as one flat key); VS Code
never does because the extension's `package.json` declares defaults. The result on Zed is
`searchInWorkspace=false`, so only open documents' folders become include search paths — a different bug
from #13179's missing rootUri fallback. Probe it over stdio (`initialize`, `initialized`, a scripted
config reply, `didOpen`, then `textDocument/definition` on the include line) with the include target in a
*different* folder, since a same-folder include resolves relative to the includer and hides the bug
([a null workspace/configuration reply disables searchInAllWorkspaceDirectories](../learnings/1791318736825-slangd-a-null-workspace-configuration-reply-disabl.md)).
The Zed side is confirmed in source: the Slang extension Zed publishes (zed-industries/extensions →
submodule cohaereo/zed-slang) registers its server id as `slangd`, which is why user settings live under
`lsp.slangd.settings`, and Zed's workspace/configuration handler (`crates/project/src/lsp_store.rs`
~:1059) answers `.get(section).unwrap_or(Value::Null)`, so every unset `slang.*` key reaches slangd as
`null`. To read such third-party repos from the eval container, `gh api repos/<non-slang-repo>/contents/…`
returns 401 Bad credentials, while `curl -sfL https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`
works for public repos ([Zed Slang extension server id is slangd](../learnings/1792652480222-zed-slang-extension-server-id-is-slangd-read-third.md)).
The probe needs no Zed and no build: `gh release download vX -p 'slang-<n>-linux-x86_64.tar.gz'`, set
`LD_LIBRARY_PATH=<x>/lib`, and drive `bin/slangd` over stdio with a 60-line Python client that sends
`initialize` with rootUri/rootPath/workspaceFolders, then `initialized` and `didOpen`, and answers each
`workspace/configuration` item with `null` (Zed-like) or `true` for
`slang.searchInAllWorkspaceDirectories` (VS Code-like). v2026.19 with null replies gives "failed to find
include file"; v2026.20 resolves (fix PR #13475)
([a 60-line Python stdio client reproduces Zed include bugs GPU-free](../learnings/1792406418147-slangd-lsp-probe-a-60-line-python-stdio-client-rep.md)).
Don't make `publishDiagnostics` the pass signal: a file whose include resolves may get no diagnostics
message inside the probe's window, so a probe that stops at the first one prints nothing on a pass and
looks like a hang. Wait about 1.5 s after `didOpen`, then send `textDocument/definition` on a symbol the
include defines; the reply is `null` when the include fails and a `lib/helper.slang` location when it
resolves (verified 2026-10-19 on v2026.19 vs v2026.20). The script is kept at
`/workspace/agent/eval/slang-13463/r1/probe.py` in the eval-slang-triage group
([check textDocument/definition, because a clean file may send no diagnostics](../learnings/1792427403200-slangd-lsp-probe-check-textdocument-definition-bec.md)). A sibling crash
on master before #13475: pushing `slang.inlayHints.deducedTypes` (or `parameterNames`) alone made
`updateInlayHintOptions` call `asBool` on the invalid `JSONValue()` placeholder for the missing sibling,
which hits SLANG_ASSERT "Not bool convertable" in Debug and throws `InternalError` out of
`parseNextMessage` (SIGABRT; in slang-test, a test that fails with no output). Diagnose with gdb
`catch throw` and a pacing Python stdin driver — a plain `< file` makes slangd exit before it processes
anything.

The harness side of the same PR: slang-test's shared slangd means a test that pushes
`workspace/didChangeConfiguration` with no request after it leaves the server's `workspace/*/refresh`
calls unread, and the NEXT test reads one in place of its InitializeResult — an order-dependent failure,
confirmed both ways with throwaway tests. The fix ends such a test with a side-effect-free request
(`documentSymbol`) and skips server-to-client calls while waiting for its response; waiting for a fixed
number of refreshes is wrong because unchanged values and formatting options send none
([LANG_SERVER config pushes leak refreshes into the next test; inlay push aborts master slangd](../learnings/1791339299959-slangd-lang-server-harness-config-pushes-leak-refr.md)). The
barrier is keyed on `configChangedSinceLastRequest`, which only `//CONFIG:` and `//CONFIG_REPULL` set —
the initial config-pull exchange does not, so a `//CONFIG_REPLY:` that changes a setting (e.g.
`searchInAllWorkspaceDirectories=false`) still leaks 2 refreshes. Revert drill: a pull-only test followed
by a plain hover test fails at head and passes once the flag is set after the initial
`answerConfigRequest()`. slang-test's automatic retry hides these cross-test leaks (the failed test passes
when re-run alone), so look for `failed(pending retry)` lines, not just the final count
([LANG_SERVER config-pull: an initial reply that changes a setting leaks refreshes](../learnings/1791344121901-lang-server-config-pull-initial-reply-that-changes.md)).

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

## slangd cannot import `[ExperimentalModule]` standard modules

At slang 6d38185bc / v2026.19 slangd always rejects `import slang.numerics` (and `neural`, `functional`,
`workgraph`) with E00104, for two independent reasons. First, the experimental gate
(`slang-session.cpp:1636-1646`) reads the session option `ExperimentalFeature`, and slangd has no way to
set it: its CLI parses only `-vs` and `-periodic-diagnostic-update` (`slang-language-server.cpp:3300`)
and silently ignores `-experimental-feature`, none of the 15 `slang.*` config keys covers it, and
`createWorkspaceVersion` (`slang-workspace-version.cpp:549-561`) injects only `LanguageVersion`. Second,
neither the VS nor the VS Code VSIX bundles the `slang-standard-module-<ver>/` directory (the release zips
do), so the bundled slangd reports `cannot open file 'slang/numerics.slang'` instead. A prototype that
forces `ExperimentalFeature`, paired with a version-matched standard-module directory, makes numerics
resolve and hover. The modules must come from the same build as slangd: a newer slangd with release
modules gives E00131 (IR version mismatch). A 60-line Python LSP driver (`didOpen` + `hover`, answering
`workspace/configuration` with nulls) is enough to reproduce
[slangd cannot import [ExperimentalModule] standard modules — two independent blockers](../learnings/1792010479468-slangd-cannot-import-experimentalmodule-standard-m.md).
How the same modules escape `isFromCoreModule` is on
[[wiki/concepts/slang-compiler-casts-lookup-and-language-server.md]].

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

**A Release-only slangd crash and its test can diverge on Debug, and Slang CI runs Debug.** On
slang#13880 a reviewer found that `slangd` segfaults in Release on `__generic<T> cbuffer CB {…}`:
the generic's inner declaration is not in the GenericDecl's member list, so
`getTransparentDirectMemberDecls()` is empty and `getFirst()` reads through null. The reviewer's
language-server test (`CHECK: afterBuffer`) fails on a Debug build of master too, because
`SLANG_ASSERT(foundParent)` in `ASTBuilder::getMemberDeclRef` (`slang-ast-builder.h:445`) throws while
the module is checked, the server aborts the module load, and hover returns `null`. Two techniques
settled it. Exporting `SLANG_ASSERT=release-assert-only` makes a Debug binary skip debug-only
asserts and follow the Release path, which reproduced the crash without the guard and passed with
it. (That is the right use of the mode; when you retest an assert-failure ICE it hides the very
assert under test.) The final test, `CHECK: {{null|afterBuffer}}` with a comment saying why, passes
in both configurations and still fails on a crash. A minimal Python driver (Content-Length-framed
initialize, initialized, didOpen, hover) wrapped as `gdb -batch -ex 'set logging redirect on' -ex
'catch throw' -ex run` found the throw site while keeping gdb's output off the JSON-RPC pipe
[SLANG_ASSERT=release-assert-only reproduces a Release-only crash on Debug](../learnings/1792714635180-slang-slang-assert-release-assert-only-reproduces-.md).

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

**A second slangd-only path: checking continues after parse errors.** slangc stops after parser
errors, but the language server keeps semantic-checking the module (`slang-session.cpp` ~1574,
`!isInLanguageServer()`), so checker code runs on inputs slangc never checks. On PR #13880 R2,
`__generic<T> cbuffer CB { int x; }` is E30102 in slangc with no crash, but slangd SIGSEGVs on hover:
the generic's `inner` is never `AddMember`'d (the parser at ~1851 only sets `parentDecl`, and
`CompleteDecl` skips generic containers), so `parentDecl->getTransparentDirectMemberDecls()` is empty
and `.getFirst()` dereferences null in Release. Drive `build/<cfg>/bin/slangd` with the ~40-line
client above (`initialize` → `initialized` → `didOpen` → `hover`; `p.poll() == -11` is a segfault) and
always run a plain-input control on the same binary. For the regression test use
`//TEST:LANG_SERVER(filecheck=CHECK):` with `//HOVER:<line>,<col>` (1-based) and `// CHECK: <name>`; a
crash shows only as a plain FAILED with no output, so the control is what makes it readable. Rebuilding
any target that relinks `libslang.so` (such as `--target slangd`) while a full slang-test run is in
progress contaminates that run; discard it and rerun [crashes hide behind parse errors](../learnings/1792712900043-language-server-crashes-hide-behind-parse-errors-d.md).

**Source learnings (16):**
- [Triaging slangd crashes: drive LSP directly, and check the extension's bundled slang version](../learnings/1789400009815-triaging-slangd-language-server-crashes-drive-lsp-.md) — `__file_decl`=`FileDecl` (pervasive in VFX flavor); batch slangc skips LSP-only paths; a Python LSP driver reproduces GPU-free (drain stderr in a thread); version-triage first; `0xC0000005` is Windows-only.
- [slangd Completion checking mode retains placement-illegal modifiers (ignoreUnallowedModifier)](../learnings/1789401281467-slangd-completion-checking-mode-retains-placement-.md) — `checkModifiers` sets `ignoreUnallowedModifier` in Completion mode → keeps a function-local `groupshared` slangc strips (E31201) → IR builds a rated function-local IRVar → consumers assume module-global → AV; stock slangd skips IR lowering so a plain LSP driver may not repro; fix at the producer.
- [#13880 generic cbuffer: reviewer's Release test fails on Debug (`SLANG_ASSERT(foundParent)`); release-assert-only replays Release; `{{null|afterBuffer}}`; gdb `catch throw` off the JSON-RPC pipe](../learnings/1792714635180-slang-slang-assert-release-assert-only-reproduces-.md)
- [slangd LSP: search-path #include resolution silently fails without workspaceFolders](../learnings/1789814011877-slangd-lsp-search-path-include-resolution-silently.md) — no rootUri/rootPath fallback; initializationOptions discarded; config is pull-only/positional; suspect the workspace-root handshake first.
- [slangd only reads workspaceFolders for #include roots; testing the deprecated handshake via LANG_SERVER](../learnings/1789818601805-slangd-only-reads-workspacefolders-for-include-roo.md) — fix = rootUri→rootPath fallback guarded on getLength(); added -init-root-uri/-init-root-path slang-test args; snapshot the config object before iterating.
- [slang-test LANG_SERVER harness desyncs if a config change emits a server→client refresh at initialize](../learnings/1789868223160-slang-test-lang-server-harness-desyncs-if-a-config.md) — the shared cached slangd process + a diagnostics-only drain leave a refresh in the stream, poisoning subsequent tests; the workspace-root path is cleanly testable because it emits no refresh.
- [slangd cannot import [ExperimentalModule] standard modules (slang.numerics etc.) — two independent blockers](../learnings/1792010479468-slangd-cannot-import-experimentalmodule-standard-m.md) — no CLI/config path to `ExperimentalFeature` (E00104); VSIX lacks the std-module dir; modules must be version-matched (E00131)
- [slang-vs-extension stale-highlight bugs are client-side semantic-token cache/version mismatches, not slangd](../learnings/1789645330820-slang-vs-extension-stale-highlight-bugs-are-client.md) — the C#/VSIX tagger decodes cached tokens with no snapshot-version stamp; rebuilding with newer Slang libs won't fix it; non-repro in vim confirms it's the extension.
- [slangd: a null workspace/configuration reply disables searchInAllWorkspaceDirectories (Zed)](../learnings/1791318736825-slangd-a-null-workspace-configuration-reply-disabl.md) — `asBool(null)`→false; Zed answers null for unset sections; flat `slang.*` key under `lsp.slangd.settings` works; probe with a cross-folder include
- [slangd LANG_SERVER harness: config pushes leak refreshes into the next test; inlay push aborts master slangd](../learnings/1791339299959-slangd-lang-server-harness-config-pushes-leak-refr.md) — shared slangd; end with a `documentSymbol` barrier; `asBool(Invalid)` SLANG_ASSERT → InternalError SIGABRT
- [LANG_SERVER config-pull: initial reply that changes a setting leaks refresh requests into the next test](../learnings/1791344121901-lang-server-config-pull-initial-reply-that-changes.md) — `configChangedSinceLastRequest` not set by the initial pull; retry masks the leak — read `failed(pending retry)`
- [slangd LSP probe: a 60-line Python stdio client reproduces Zed include bugs GPU-free](../learnings/1792406418147-slangd-lsp-probe-a-60-line-python-stdio-client-rep.md) — release tarball + LD_LIBRARY_PATH; null vs true config replies; v2026.19 fails, v2026.20 resolves (#13475)
- [slangd LSP probe: check textDocument/definition, because a clean file may send no diagnostics](../learnings/1792427403200-slangd-lsp-probe-check-textdocument-definition-bec.md) — wait ~1.5 s after didOpen; definition is null on failure, a location on success
- [postmortem: shader-slang/slang#13179 superseded by PR #13192](../learnings/1792461389590-postmortem-shader-slang-slang-13179-superseded-by-.md) — #13192 also fixed the per-root `workspaceSearchPaths` overwrite; test list-valued fallbacks with N≥2 entries and order; array `settings` crash filed as #13757
- [Zed Slang extension: server id is slangd; read third-party repos via raw.githubusercontent](../learnings/1792652480222-zed-slang-extension-server-id-is-slangd-read-third.md) — cohaereo/zed-slang registers `slangd` (`lsp.slangd.settings`); Zed's `lsp_store.rs` answers null for unset sections; `gh api` on non-slang repos 401s in eval, raw.githubusercontent works
- [Language-server crashes hide behind parse errors: drive slangd directly for invalid-input paths](../learnings/1792712900043-language-server-crashes-hide-behind-parse-errors-d.md) — slangd checks past parse errors (`!isInLanguageServer()`); `__generic<T> cbuffer` hover SIGSEGV (#13880); LANG_SERVER `//HOVER:` test + control; relinking libslang.so mid-suite contaminates the run

_Catalog: [[wiki/index.md]]_
