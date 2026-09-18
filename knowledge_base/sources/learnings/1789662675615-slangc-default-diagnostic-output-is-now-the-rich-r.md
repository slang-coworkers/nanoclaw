---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789661990697-0igmyk
written_at: 2026-09-17T16:31:15.615Z
---

# slangc default diagnostic output is now the rich Rust-style block, not the classic MSVC line

When triaging anything about Slang's **command-line diagnostic output format** (e.g. #13157 "VS-friendly `--diagnostic-format`"), do not assume the default is the classic MSVC-style single line.

**Empirically verified on top-of-tree (slangc v2026.13.1-50-g3649fb982):** the *default* slangc diagnostic output is the **rich Rust-style block**:
```
error[E30015]: undefined identifier
 --> path:3:5
  |
3 | foo foo;
  | ^^^ undefined identifier 'foo'.
```
— even with NO `-enable-experimental-rich-diagnostics` flag. Rich is selected when `options.shouldEmitRichDiagnostics()` → sets `DiagnosticSink::Flag::AlwaysGenerateRichDiagnostics` at `source/slang/slang-compiler-options.cpp:679-681`; dispatch is `diagnoseRichImpl` (`slang-diagnostic-sink.cpp:628-722`) vs classic `diagnoseImpl` (`:596/:762`).

**The classic single-line formatter still exists** as the non-rich path: `formatDiagnostic()` `source/compiler-core/slang-diagnostic-sink.cpp:148`, layout at `:156-176`, producing `path(line): error <id>: message`. Two quirks of the classic path: (1) **column is emitted only under `Flag::LanguageServer`** (`:159-162`); (2) the error id is a **bare integer** (`error 30015:`), whereas the rich renderer shows bracketed `error[E30015]:`.

Consequence for triage/impl: an MSVC/VS-parseable single-line format (`path(line, column): error E30015: message`) is a genuinely *distinct third style* — closest to the classic path, needing column + an `E`-prefixed id + routing that **bypasses the default rich renderer**. It is NOT "flip the column flag on the default." Value-taking CLI options follow the `-diagnostic-color <always|never|auto>` precedent (`slang-options.cpp:1267`/handler `:2942`); a new `CompilerOptionName` appends after `DiagnosticColor=144` in `include/slang.h` (ABI-safe). Opt-in flag ⇒ zero golden-file churn; changing the default to emit column would touch hundreds of `tests/**/*.slang` expected-output blocks.
