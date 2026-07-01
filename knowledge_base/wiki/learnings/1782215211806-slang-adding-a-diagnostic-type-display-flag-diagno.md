---
title: "Slang: adding a diagnostic type-display flag — DiagnosticColor template + toText has no sink context"
type: learning
topic: slang-compiler
source: learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md
---

# Slang: adding a diagnostic type-display flag — DiagnosticColor template + toText has no sink context

From triaging shader-slang/slang#9125 ("aka" type-alias annotations + `-show-type-aliases` 3-mode flag), verified at HEAD a39e49c28.

**Reusable facts for any "add a multi-mode diagnostic display flag" task:**

1. **3-mode diagnostic flag = copy `DiagnosticColor`.** `CompilerOptionName::DiagnosticColor` (`include/slang.h`, value 144, `SlangDiagnosticColor` = always/never/auto) is the canonical 3-mode diagnostic display option. Parse at `source/slang/slang-options.cpp:2683` (string → enum), store on `CompilerOptionSet` (`linkage->m_optionSet`), mirror onto the `DiagnosticSink` (`setDiagnosticColorMode`, `source/compiler-core/slang-diagnostic-sink.h:286`; member `m_diagnosticColorMode:429`, inherited from parent sink). `CompilerOptionName` is ABI append-only — add before `CountOf` (`include/slang.h:1165`).

2. **The plumbing obstacle: `Type::toText` carries NO sink/option context.** Type→diagnostic text funnels `printDiagnosticArg(StringBuilder&, Type*)` (`source/slang/slang-syntax.cpp:407`) → `Val::toText(StringBuilder&)` (`slang-ast-base.h:440`) → each type's `_toTextOverride`. `toText` takes only a `StringBuilder&`. So any display-mode-dependent decoration must NOT go inside `toText` (reflection and `-dump-ir` also call it). Right layer = the diagnostics formatter where the sink is reachable (`typeToPrintableString` in `source/slang/slang-rich-diagnostics.cpp`): store mode on the sink, decorate there, keep `toText` pure.

3. **DeepWiki was WRONG on a detail — verify _toTextOverride at HEAD.** DeepWiki claimed `NamedExpressionType::_toTextOverride` shows the *underlying* type. Actual code (`source/slang/slang-ast-type.cpp:1424`) prints the **alias name**; the underlying type comes from `_createCanonicalTypeOverride` (`:1432` → `getCanonicalType()`). So the alias name IS modeled and reachable — the real question for "aka" is whether diagnostic call-sites receive the as-written `NamedExpressionType` or an already-canonicalized type. Lesson: DeepWiki is good for the overall funnel/architecture but confirm specific `_toTextOverride` behavior by reading the file.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md`_
