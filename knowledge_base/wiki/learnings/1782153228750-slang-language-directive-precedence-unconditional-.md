---
title: "Slang #language directive precedence: unconditional per-file override of the option-set default"
type: learning
topic: slang-compiler
source: learnings/1782153228750-slang-language-directive-precedence-unconditional-.md
---

# Slang #language directive precedence: unconditional per-file override of the option-set default

For the slangd default-language-version feature (slang-vscode-extension#70) and any reasoning about `#language` vs a global/default language version, the precedence is **well-defined today** (not undefined), verified at slang HEAD 2b14ffd06:

- The per-file starting version = `optionSet.getLanguageVersion()` (the session/compiler default), seeded into the preprocessor as a by-ref out-param at `slang-compile-request.cpp:324`, written to `translationUnitSyntax->languageVersion` at :339.
- The preprocessor's internal `languageVersion` starts at `SLANG_LANGUAGE_VERSION_UNKNOWN` (`slang-preprocessor.cpp:1326`). A `#language slang <ver>` directive sets it **unconditionally** in `HandleLanguageDirective` (`slang-preprocessor.cpp:4568`) — this is a plain assignment, so it overrides the default in *either* direction (a downgrade like default=2026 + `#language slang 2025` → the file parses at 2025).
- At end of preprocessing the directive value is written back to the caller's version **only if a directive was actually seen** (`!= UNKNOWN`, `slang-preprocessor.cpp:5156-5157`). So directive-less files keep the default.

Net rule (the least-surprising one, and what the code already does): **the global/default version applies only to files with no `#language` directive; an explicit directive always wins.** No real conflict to resolve.

Two corollaries that came up with maintainers:
- `slangc -std <ver>` (and `-lang`) already sets `CompilerOptionName::LanguageVersion` (`slang-options.cpp:574-576`, applied at :3181) — i.e. the "default version for files without a directive" CLI capability already exists; slangd just needs to feed the same option into its per-file `SessionDesc`. No net-new compiler infra.
- Valid language versions are exactly `legacy`/2018, 2025, 2026 (`isValidSlangLanguageVersion`, `slang-compiler.cpp:7`); anything else (e.g. `#language slang 2027`) is rejected with an UnknownLanguageVersion diagnostic regardless of any default.
- Edge note: `maybeUpgradeLanguageVersionFromLegacy` (`slang-parser.cpp:1216`) auto-bumps LEGACY→2025 when a visibility modifier is parsed — only relevant when the version is LEGACY; a no-op for 2025/2026 defaults.

Also: a `#language` directive in a *shared file* only propagates through a textual `#include`, NOT across an `import` module boundary (each module has its own `currentModule->languageVersion`) — which is why a manual shared-directive workaround is fragile and a first-class editor/global setting is the robust fix.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782153228750-slang-language-directive-precedence-unconditional-.md`_
