---
title: "Adding a slangd config setting is a two-repo job — copy the workspaceFlavor template"
type: learning
topic: slang-compiler
source: learnings/1781797125582-adding-a-slangd-config-setting-is-a-two-repo-job-c.md
---

# Adding a slangd config setting is a two-repo job — copy the workspaceFlavor template

Any "let users configure X in slangd via a VSCode setting" feature (e.g. slang-vscode-extension#70, default language version) is **two repos**, not one. The extension cannot do it alone — there is no per-file injection and `predefinedMacros` are preprocessor macros, not compiler options.

**The proven template (copy it):**
- **slang repo (slangd side, the real work):** add the config key to `LanguageServer::sendConfigRequest` (source/slang/slang-language-server.cpp ~2492-2520, the `item.section = "slang.<key>"` list) AND to the config-response dispatch (~3024-3104, the `if (key == "slang...")` chain); store the value on `Workspace` (source/slang/slang-workspace-version.h ~171-187); **apply** it where per-file sessions are built — `Workspace::createWorkspaceVersion()` (source/slang/slang-workspace-version.cpp ~479-529), which assembles a `slang::SessionDesc` (searchPaths + preprocessorMacros) then `createSession`. Inject compiler options there via `SessionDesc.compilerOptionEntries` (e.g. `CompilerOptionEntry{CompilerOptionName::<X>, val}`) or `version->linkage->m_optionSet.add(OptionKind::<X>, val)` right after createSession.
- **slang-vscode-extension repo:** declare `slang.<key>` in `package.json` `contributes.configuration.properties`. It is pushed to slangd via the LSP `workspace/configuration` pull (client `middleware.configuration` → `expandSlangSettingsInConfiguration` in configVariables.ts; var-expansion only needed for path-valued settings).

**Precedent PRs:** `slang.workspaceFlavor` = slang#8915 (4 files: slang-language-server.cpp/.h + slang-workspace-version.cpp/.h) + ext#55 (package.json only, +10). `slang.additionalSearchPaths` var-expansion = ext#63.

**Language-version specifics:** `SlangLanguageVersion` (include/slang.h:5596): DEFAULT=LEGACY(2018), LATEST=2026. With no `#language slang <ver>` directive, the version = `optionSet.getLanguageVersion()` default (slang-compile-request.cpp:324-339) = LEGACY; slangd never overrides it, so editor diagnostics diverge from a global -lang/-std build. Public option is `CompilerOptionName::LanguageVersion = 107` (slang.h:1095). The `#language` directive is applied in the preprocessor (slang-preprocessor.cpp:4561) and should still override a global default — verify the legacy-upgrade path `maybeUpgradeLanguageVersionFromLegacy` (slang-parser.cpp:1216). All file:lines @ slang HEAD a84f48e62.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781797125582-adding-a-slangd-config-setting-is-a-two-repo-job-c.md`_
