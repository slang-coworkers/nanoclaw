# Slang API compiler-options: applySettingsToDiagnosticSink double-apply clobbers with defaults; API-path bugs need slang-unit-test not .slang

## Context
shader-slang/slang#11890: setting `CompilerOptionName::DiagnosticColor = ALWAYS` via the C++ API
(`SessionDesc::compilerOptionEntries`) colored only pre-codegen diagnostics; target-stage ones came
out ASCII. CLI `-diagnostic-color always` worked for both. Confirmed at HEAD f490a52aa.

## The pattern (reusable): "apply-from-empty-option-set clobbers with the default"
`ComponentType::getTargetArtifact` (source/slang/slang-linkable.cpp:750-751, and again in its
exception handler at :771-772) applies diagnostic settings twice — first from `linkage->m_optionSet`,
then from the component's own `m_optionSet`:
```
applySettingsToDiagnosticSink(&sink, &sink, linkage->m_optionSet);  // has API-set value
applySettingsToDiagnosticSink(&sink, &sink, m_optionSet);           // ComponentType::m_optionSet — EMPTY for a plainly-loaded module
```
`ComponentType::m_optionSet` is populated ONLY by `linkWithOptions()`; a module from
`loadModuleFromSourceString` has an empty one. The color line in
`applySettingsToDiagnosticSink` (source/slang/slang-compiler-options.cpp:442-445) applies
UNCONDITIONALLY, and `CompilerOptionSet::getIntOption(name)` (slang-compiler-options.h:270-278)
returns `getDefault(name).intValue` when the option is ABSENT. For DiagnosticColor the default is
`SLANG_DIAGNOSTIC_COLOR_AUTO`, so the second (empty-set) call overwrites the correct ALWAYS with
AUTO; AUTO then defers to `writer->isConsole()`, and the in-memory API blob writer isn't a console →
no color.

**General lesson:** when a setting is layered by two `apply(optionSet)` calls, applying it
unconditionally means an option set that DOESN'T carry the option resets it to the default (treats
"unset" as "reset"), silently clobbering a value set by an earlier layer. The fix is to guard the
apply on presence — `if (options.hasOption(name)) { ... }` (slang-compiler-options.h:102). The same
header already uses this idiom for denormal modes / language version (:393/:402/:411/:435). The
`DiagnosticSink` default is already AUTO (slang-diagnostic-sink.h:429), so guarding is
behavior-preserving when no layer sets the option.

**Why the CLI is immune:** the `OptionKind::DiagnosticColor` case in slang-options.cpp:2817-2839 sets
the value on `linkage->m_optionSet` AND directly calls `setDiagnosticColorMode` on the sink + all
ancestor sinks at parse time, bypassing the double-apply path entirely. So a CLI repro is impossible
for API-path option-plumbing bugs — the two paths genuinely differ.

## Testing insight (bit me / would bite the next reader)
An API-path option bug like this CANNOT be covered by a `.slang` slang-test file — slang-test drives
the CLI/test harness, whose color path is immune. The regression test must be a GPU-free
**slang-unit-test** (tools/slang-unit-test): create a global session → create a session with
`{DiagnosticColor, Int, SLANG_DIAGNOSTIC_COLOR_ALWAYS}` in SessionDesc → `loadModuleFromSourceString`
of a shader that produces a target-stage diagnostic (`void main(int b)` → E39019) → `getTargetCode` →
assert the returned diagnostics blob contains an ANSI escape (`"\x1b["`). SPIR-V codegen to an
in-memory blob is headless, so no GPU is needed.

## Where API compiler options live (for future option-plumbing triage)
`SessionDesc::compilerOptionEntries` → `Linkage::m_optionSet` at session creation. `TargetRequest`
and `ComponentType` have their own `CompilerOptionSet`s that inherit from / layer over the linkage
set; `ComponentType::m_optionSet` is filled only via `linkWithOptions()`. Front-end module-load
diagnostics apply once from the linkage set (slang-session.cpp ~:228), which is why they're
correctly configured while a naive second apply from an empty component set can undo it.
