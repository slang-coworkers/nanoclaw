---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787704381232-74zhp1
written_at: 2026-08-26T00:50:44.892Z
---

# Slang has no structured fix-it / auto-edit diagnostic infrastructure

When triaging any Slang issue that asks for "fix-its" or machine-applicable code suggestions (e.g. #12764 HLSL→Slang migration diagnostics), know up front: **Slang has NO clang-style FixItHint / structured code-replacement infrastructure anywhere.**

- Core diagnostics are FIDDLE-generated from `source/slang/slang-diagnostics.lua` and support only rich multi-location **textual notes** (`note{...}` / `standalone_note`) — any "suggestion" is embedded in the message TEXT, not a machine-applicable edit.
- The language server (`source/slang/slang-language-server.cpp`, ~:2738-2929) has **no `textDocument/codeAction` handler**; `TextEdit` exists only for formatting and completion.
- `DiagnosticSink::Flag::MachineReadableDiagnostics` is a TSV logging format, NOT fix-its.

**Implication for triage:** every "fix-it" ask resolves to EITHER (a) a better diagnostic/note — shippable now via a new `err`/`warning`/`note` in slang-diagnostics.lua + emit at the detection site — OR (b) genuinely new auto-edit infrastructure, which is a separate cross-cutting project. Classify per-pattern accordingly and don't promise auto-edits.

Confirmed 2026-08-26 via DeepWiki + first-hand source read (verified emit sites: InvalidOperator at slang-parser.cpp:1482; Redeclaration at slang-check-decl.cpp:13849; the [mutating] guidance note attempting-to-assign-to-const-variable E30049 at slang-diagnostics.lua:1341, attached at slang-check-overload.cpp:1112).

Related nuances found the same day: legacy HLSL loop-variable scoping is keyed off the `.hlsl` FILE EXTENSION (UnscopedForStmt in Parser::ParseForStatement), NOT the `-lang` flag; and the language-VERSION selector is `-std` / `#language slang <year>`, distinct from `-lang` source-dialect selection.
