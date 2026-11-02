---
title: "Slang Diagnostics System: Catalog, Definitions, and Rendering"
type: concept
group: slang-grab-bag
tags: [diagnostics, slang-diagnostics.lua, regenerate.py, diagnostics-catalog, warning, FileCheck, rich-diagnostics, pragma-warning, severity, Lua]
source_count: 35
---

# Slang Diagnostics System: Catalog, Definitions, and Rendering

The Lua-driven definition layer, the generated catalog tests and `regenerate.py`, rendering/formatting (FileCheck, the rich renderer), severity/label policy, and recurring false-positive families.

## TL;DR

- **New diagnostics go in `source/slang/slang-diagnostics.lua`**, not the stale `slang-diagnostic-defs.h`. `Diagnostics::Unimplemented` is `Severity::Internal` (aborts + "file a GitHub issue"): wrong channel for user-correctable limits; use a dedicated error or `SLANG_ASSERT`. Grep the live Lua for the next-free code.
- **Output is `warning[ENNNNN]:` (brackets), never `warning NNNNN`.** `CHECK-NOT: warning 30856` passes vacuously; assert `E30856` / `[E30856]` and verify against the bug-present binary.
- **`regenerate.py` is a linter, not the generator**; `.slang` catalog tests are LLM/operator-driven. Three divergent provenance stores (`//META`, `README.md`, `freshness.json`); `mark-fresh` touches only `freshness.json`.
- **Deprecate-and-hide-from-docs = `[deprecated("msg")]` + `//@hidden:`**; neither alone does both.
- **warn→error on invalid/miscompiling code, and a new error on meaningless code (`row_major int x;` → E39026), are `pr: non-breaking`**: list the newly rejected forms and let the maintainer escalate (breaking = valid code users rely on, or ABI). A `check-pr-label` failure right after a label swap is a race. warn→error-by-version is a call-site if/else on `languageVersion` (no per-diagnostic knob); a 202c *error* form needs `SLANG_LANGUAGE_VERSION_202C` (OPEN PR only), a pure warning needs no atom.
- **A severity promotion needs a test that pins SEVERITY in never-emitted code**; message-only CHECKs pass either way.
- **"Is it breaking?" is a measurement**: master-vs-PR repro table, classified against the proposal; the label is the maintainer's.
- **Adjudicate "false-positive warning?" by diffing emitted target code**; run the discriminating control before relaying a mechanism (E36108 'llvm' was alias membership, not a linked-library leak).
- **API-path option bugs can't be `.slang` tests** (the CLI path is immune). `applySettingsToDiagnosticSink` double-applies, and an empty option set (the linked *composite*'s, not the module's) clobbers with defaults. Write a GPU-free `slang-unit-test`.
- **E36110/E36108 false positive on a public interface impl calling a portable stdlib fn** (`normalize`, #12755): inference is target-agnostic and a Public decl's set is clamped. Spurious = extra TARGET the impl merely supports; legit = extra SUB-CAP needed within a shared target.
- **E30082 (float→double) tags only scalar `double.__init(float)`**; vector/matrix go through one untagged generic init and warn silently (#12930); key off the concrete element `BaseType` at the coercion site. Its float-literal exemption is syntactic (a paren or `?:` around the literal warns), and since #11513 the lexer stores unsuffixed literals already float-rounded, so a value-exactness check needs the raw token text (#14057).
- **The rich renderer drops all span labels when the location does not resolve** (`hasValidLocation`), so E30015 loses the name; `parseTermString` locations (`-entry`, `-specialize`) never resolve. `-diagnostic-format vs` still shows the label (#14137).
- Worked incident case studies are on the companion page (see end).

## Lua-Driven Diagnostic Definitions

New diagnostics go in `source/slang/slang-diagnostics.lua`, **not** the stale `slang-diagnostic-defs.h`. The parser accepts `[attr]` and `[[attr]]`; a no-arg marker attribute needs only two edits (`.meta.slang` + `.h`) ([diagnostics are Lua-driven](../learnings/1786010193246-slang-diagnostics-moved-from-slang-diagnostic-defs.md)). `Diagnostics::Unimplemented` is `Severity::Internal` (`SLANG_ABORT_COMPILATION` + "file a GitHub issue"), so use a dedicated error or `SLANG_ASSERT` for user-correctable limits ([Unimplemented is Severity::Internal](../learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md)). Codes cited in issues go stale when stacked branches haven't landed; grep the live Lua for the next-free code ([numbering caveat, #11452](../learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md)).

## Diagnostics Catalog and regenerate.py

Generated catalog tests have **three divergent provenance stores** (per-file `//META`, bundle `README.md`, `freshness.json`); `regenerate.py mark-fresh` updates only `freshness.json`, so a hand-edited `.slang` file also needs its `//META` bumped ([3 provenance stores](../learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md)). `doc_section_digest` is underspecified (39 files share one hash, 224 are all-zero placeholders, no deterministic computation), so a naive LLM backfill manufactures unverifiable digests ([digest backfill not trivial](../learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md)); bundle drift detection lives in `_classify`/`cmd_list_stale` (not `cmd_verify`) and CHECK-level lint already pins sources, making it redundant ([drift in _classify](../learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md)).

`regenerate.py` validates and lints but **does not generate**; generation is LLM/operator-driven via prompt files, and a warn-only guard scoped `if not is_catalog:` misses placeholders reintroduced onto catalog files ([regenerate.py is lint](../learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md)). The stale E30055 test uses GNU elvis `b ?: 0.0` (unsupported → parse error, not a silent pass); fix the generation prompt, not the Lua ([#11407 E30055](../learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md)).

## stdlib Deprecation: Two Separate Mechanisms

Deprecate AND hide from online docs = `[deprecated("message")]` (warning) + the `//@hidden:` pragma (doc exclusion) ([two mechanisms](../learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md)). The parsed token is `"hidden:"` (no `@`); ByteAddressBuffer deprecation must cover all three buffer variants ([achievable today](../learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md)).

## FileCheck Format: `warning[ECODE]`, Not `warning NNNNN`

Diagnostics render as `warning[ENNNNN]:`. `// CHECK-NOT: warning 30856` never matches and passes vacuously; assert `CHECK-NOT: E30856`, `[E30856]` or `warning[41012]`, and verify on the bug-present binary ([vacuous CHECK-NOT](../learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)).

## Pragma Warning Scope Across Files

Each `__include`d file gets a fresh preprocessor whose `absoluteSourceLocCounter` starts at 0, so absolute locations collide in the shared `WarningStateTracker` timeline; `addPragmaPop` also restores all IDs on pop (not just those touched), shadowing root-file disables ([cross-file pragma scope](../learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md)).

## Rich Diagnostic Renderer and Callback API

Known renderer bugs: a zero-width EOF span duplicates the last character (color path), and codepoint columns are indexed by byte offsets ([EOF span, byte columns](../learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md)). `SlangDiagnosticCallback` has no severity parameter and covers only the legacy path; the roadmap is the Rich Diagnostics rewrite, not bolt-ons ([callback API legacy](../learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md)).

**An unresolved location loses every span label** (#14137, 6815ed82d). In `slang-rich-diagnostics-render.cpp:897-929`, `hasValidLocation` (line > 0 or non-empty file name) gates the location line and every span label, including `renderOrphanedLabels`, so only the Lua summary prints. Since #10125 (v2026.4) many summaries take no parameters: E30015 "undefined identifier" carries the name only in its label. `Linkage::parseTermString` (`slang-session.cpp:1075`) parses into a stack-local `SourceManager` destroyed before `CheckTerm`, so `-entry`, `[patchconstantfunc]` and `-specialize` locations never resolve (`-specialize Bogus` → bare `error[E30015]: undefined identifier`). `-diagnostic-format vs` and `-enable-machine-readable-diagnostics` still print the label; DeepWiki's "orphaned labels print without a location" is wrong for master; v2026.3.1 classic format still printed the name [labels dropped without location](../learnings/1793544034315-slang-rich-renderer-drops-span-labels-when-the-dia.md).

**Range underlining is not a rendering change** (#10476). `DiagnosticSpan` is `{ SourceRange range; String message; }` and `makeLayoutSpan` underlines when `begin != end`. The flattening is in authoring/plumbing: DSL `getLocationExpr` maps each location to ONE SourceLoc and codegen emits `SourceRange{<single loc>}` — the choke point. "Span accepts a SourceRange" is a small DSL+codegen change; "AST/IR insts *store* SourceRange" (~668/~313 sites + serialization) is a separate large follow-up ([render layer supports SourceRange](../learnings/1783523470770-slang-rich-diagnostics-render-layer-already-suppor.md)). A multi-mode type-display flag (type-alias "aka") copies the `DiagnosticColor` option pattern and decorates in the diagnostics formatter, since `Type::toText` has no sink ([type-display flag](../learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md)).

## Severity Changes and PR Labels

**warn→error and newly diagnosing meaningless code are non-breaking**; breaking means valid code or ABI. The maintainer reverted `pr: breaking change` to `pr: non-breaking` for a `[[vk::location]]` misuse escalation (#6216) ([warn→error non-breaking](../learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)); `spirv_asm` E29118 (#12506) and E29103 note→error (#13809) followed. #12992 (`row_major int x;` → E39026) was bot-labeled breaking and relabeled `pr: non-breaking` by jkwak-work. Default: `pr: non-breaking`, list newly rejected forms, let the maintainer escalate. CI trap: during a label swap `check-pr-label` can run between unlabel and label and fire a `github.ci_failed` that passes on rerun; compare `issues/<n>/events` timestamps with the check-run `started_at` ([meaningless code non-breaking](../learnings/1790877742239-slang-pr-label-newly-diagnosing-meaningless-code-i.md)).

**Pin the SEVERITY in never-emitted code.** For a `warning`→`err` move (E29103, #13809), message-only CHECKs pass under both severities. Annotate `^^^ error E29xxx` and add a case where the bad code is never emitted (unused function, or a `__target_switch` `case spirv:` arm under `-target hlsl`). Prove the pins FAIL on master by running master's `slang-test` from the master tree root, since `-bindir` does not switch the compiler for SIMPLE/COMPARE_COMPUTE (see [Release-Build Divergences](slang-build-release-divergences-and-sanitizers.md)) ([pin the SEVERITY](../learnings/1792580635936-promoting-a-slang-diagnostic-note-error-pin-the-se.md)).

**warn→error by language version is a call-site if/else**; there is no per-diagnostic knob. Copy `volatile` (`slang-parser.cpp:10284-10296`): ERROR `RemovedModifierUsage` at `>= SLANG_LANGUAGE_VERSION_2026`, else WARNING `DeprecatedModifierUsage` at `>= 2025`, via `parser->currentModule->languageVersion`. `UnintendedEmptyStatement` (**20101**, `slang-diagnostics.lua:979-984`) is parser-only: `Parser::ParseStatement(Stmt* parentStmt)` fires it only under `as<IfStmt>(parentStmt)`; a bare `;` is a fieldless `EmptyStmt` (`{}` → `BlockStmt`), so no false positives on empty blocks. for/while/do/catch/defer are silent because they call `ParseStatement()` with no parent — threading the parent there is the extension hook (#12296). A 202c *error* form needs `SLANG_LANGUAGE_VERSION_202C` (OPEN PR #12179 only); a pure warning ships independently ([empty-statement lint](../learnings/1785434273353-empty-statement-lint-unintendedemptystatement-2010.md)).

**"Is it breaking?" is answered from the compiler, not the design.** On #13537 a draft "no" had three errors caught by OUTPUT_REVIEW: the repros compiled on master and failed on the PR; "never documented" was false (the base commit's doc comment had `/// @param format` — grep the base, not only `docs/`); a test edit was misattributed (read the diff line). Method: 5-8 minimal repros on master and PR builds, tabulate exit codes and errors, classify each break as covered by the proposal / consequence of design / not covered, and leave the label to the maintainer ([answer from the compiler](../learnings/1791569984990-is-it-breaking-answer-from-the-compiler-not-from-t.md)).

## validateEntryPoint Has No Cross-Entry-Point SV Aggregation

Conflicting/duplicate system-value semantics (#11855 multiple depth outputs; umbrella #6319) slip through because `validateEntryPoint` checks SV semantics per parameter; closing it needs an aggregation pass, not a per-case special ([per-param SV validation](../learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md)).

## C++ API Option Plumbing: the Empty-Option-Set Clobber (DiagnosticColor)

`DiagnosticColor = ALWAYS` via `SessionDesc::compilerOptionEntries` colored only pre-codegen diagnostics, while CLI `-diagnostic-color always` colored both (#11890/#11891, f490a52aa). `ComponentType::getTargetArtifact` applies `linkage->m_optionSet` then the component's own `m_optionSet` to one sink; `applySettingsToDiagnosticSink` applies color unconditionally and `getIntOption` returns AUTO for an absent option, so the empty second layer clobbers ALWAYS. Fix: `if (options.hasOption(CompilerOptionName::DiagnosticColor))` ([double-apply clobber](../learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md)). The empty set is the linked **composite**'s, not the module's: `Module`'s ctor copies linkage options (`slang-module.cpp:27`), but `CompositeComponentType` (`slang-linkable-impls.cpp:48`) is populated only by `linkWithOptions()` ([CORRECTION: composite's set](../learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md)). `hasOption` is path-specific: `getEntryPointCode` force-materializes keys like Optimization (false positives), but on the `getTargetCode` composite path `DiagnosticColor` is genuinely absent-vs-set; a revert-drill unit test falsifies force-materialization ([hasOption reliable here](../learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md)). Test with a GPU-free `slang-unit-test` (set the option in `SessionDesc`, `loadModuleFromSourceString`, `getTargetCode`, assert the blob contains `\x1b[`); a `.slang` test cannot reach the API path.

## False Positives: Adjudication and Known Families

**Adjudicate by diffing emitted code**: when a maintainer disputes a diagnostic (e.g. E41021), compile the divergent cases and diff the target output ([diff emitted code](../learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md)).

**E41017 on `export __global __extern_cpp` host globals (#12006).** `checkUninitializedGlobals` exempts `IRSemanticDecoration`/`IRGlobalInputDecoration`/`IRVulkanHitAttributesDecoration` but not `IRExternCppDecoration`, which belongs there; exempting is false-negative-safe (fires only with no init block and no `Store`). Predicate width (bare decoration vs. plus export linkage) is a maintainer call ([#12006 E41017](../learnings/1783545729206-slang-12006-e41017-false-positive-on-export-global.md)).

**E36108 'llvm' is alias membership (#12007).** `[require(sm_6_0)]` + a GPU-only op reports "not compatible on target 'llvm'" even for `-target spirv`. "llvm is linked" is refuted by two controls (Debug slangc without libslang-llvm.so reproduces; `[require(spirv_1_3)]` is clean): `sm_6_0` lists cpp+llvm disjuncts and the public-decl check needs every disjunct; `llvm` is named as the highest-ordered failing atom. Fix: `[require(spirv, sm_6_0)]` at use sites (zero risk) vs. dropping cpp/llvm from `sm_*_version` (high blast radius). Run the 30-second control before relaying a mechanism ([#12007 alias](../learnings/1783547031032-slang-12007-e36108-llvm-false-positive-is-the-sm-6.md)).

## E36110/E36108 Interface-Conformance False Positive (#12755)

A `public struct` implementing a `public interface` whose method calls `normalize` fails with **E36110** ("capability 'cuda_sm_2_0' incompatable with the interface requirement") or **E36108** ("target 'llvm'") even for `-target hlsl`; removing `normalize` or making the impl non-exported fixes it.

Root cause (master): stdlib fns advertise targets they WORK ON — `normalize` is `[require(cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm, sm_4_0_version)]`, and `sm_4_0_version` includes `_cuda_sm_2_0`. Front-end `_propagateRequirement` UNION-joins every callee's full `[require]` across all targets (`-target` applies only in IR). In `slang-check-decl.cpp:20975-21020` a Public decl's inferred set is CLAMPED and the witness-table check (`checkCapabilityRequirement(MustHaveEqualAbstractAtoms, ...)`, `:~21168`) fires; an internal decl takes the JOIN path gated on `ExplicitlyDeclaredCapabilityModifier`. In Slang 2026+ members inherit the parent's visibility. One defect, routed by `hasTargetAtom`: E36108 on a target-COUNT mismatch (`slang-capability.cpp:1459-1477`), E36110 on an extra SUB-CAP within a shared target (`:1537`).

**Discriminator and fix:** an extra TARGET the impl merely supports is spurious; an extra SUB-CAP it needs within a shared target is legit (`capability2.slang`'s `spvGroupNonUniformArithmetic` must keep failing). Explicit-`[require]` impls keep `MustHaveEqualAbstractAtoms`; inferred-only impls use `AvailableCanHaveSubsetOfAbstractAtoms` against the requirement PROJECTED to the requested targets, strict when none (precompile / language server `SLANG_TARGET_UNKNOWN`). `isTargetVersionAtom` (`slang-capability.cpp:167`) omits cuda SM atoms, so a version-vs-feature cut is unsound. Repro: hand-written public interface + struct; arithmetic body clean, `normalize` body → E36108 ([inherits full cross-target require](../learnings/1787690962502-e36110-e36108-false-positive-public-interface-impl.md), [witness-table projection fix](../learnings/1787698928314-e36108-e36110-interface-conformance-false-positive.md)).

## E30082 float→double Tags Only Scalar Conversions (#12930)

**E30082** is emitted in `SemanticsVisitor::_coerce` (`slang-check-conversion.cpp:2883-2892`) only at `CoercionSite::Argument`, when the chosen initializer carries `kBuiltinConversion_FloatToDouble` (`getImplicitConversionBuiltinKind`, `:336-344`) and `fromExpr` is not a `FloatingPointLiteralExpr`. Only the scalar `double.__init(float)` from the base-type meta-loop (`core.meta.slang:1213-1224`) has that tag; vector/matrix use one generic init (`core.meta.slang:2412-2417`) with a 1-arg `__implicit_conversion($(cost))`, so the kind is `Unknown` and they warn silently. Tagging the generic init would catch every float-family conversion (double→float, half→float); the fix peels `VectorExpressionType`/`MatrixExpressionType` to the element `BasicExpressionType` at the emission site and warns on Float→Double, retiring the scalar-only tag. E30082 had no test coverage ([scalar-only tag](../learnings/1788791945839-e30082-float-double-warning-only-tags-scalar-conve.md)).

**The literal exemption is syntactic (#14057)** (`slang-check-conversion.cpp` ~:3006-3015 on master): `takeD((10e+16))` and `takeD(c ? 10e+16 : 1.0)` warn (the paren / float `?:` is converted, even when exact); `takeD(10e+16)`, `d * 10e+16`, `double x = 10e+16;`, assignment and return are silent; `-lit` stays a literal (the parser folds the minus, `slang-parser.cpp` ~:10279). Since #11513 (2026-06) the lexer parses unsuffixed/`f` decimal literals as `float` (`slang-lexer.cpp` ~:1332), so `FloatingPointLiteralExpr::value` is already rounded and an exactness check needs the raw `LiteralExpr::token` (not a FIDDLE field); pre-#11513 builds emit the same CUDA value, so no regression. The value-based precedent is E40016 IntegerConstantOverflow in the same `_coerce` block (~:2884; Argument/Initializer/Assignment/Return, skips the core module) [literal exemption is syntactic](../learnings/1793311782255-e30082-literal-exemption-is-syntactic-unsuffixed-f.md).

## Deep-Dive Incidents & Case Studies (split out)

The worked *incidents* — E36121-as-a-pre-existing-discard, proving a one-site guard fix complete, "a warning is not the end of a compile" (#8785 ICE/SIGSEGV), the severity-downgrade-receiver rule, shared-formatter golden regressions, `(Struct)0` deprecation, and the std140 source-loc drop — live on the companion page [Slang Diagnostics: Deep-Dive Incidents & Case Studies](slang-misc-diagnostics-deep-dives.md).

**Source learnings (35):**
- ['Is it breaking?' — answer from the compiler, not the design doc](../learnings/1791569984990-is-it-breaking-answer-from-the-compiler-not-from-t.md) — #13537 master-vs-PR repro table; grep base doc comments.
- [Empty-statement lint (20101) is a parser check keyed on parent-stmt type](../learnings/1785434273353-empty-statement-lint-unintendedemptystatement-2010.md) — volatile if/else pattern; 202c error blocked on #12179.
- [stale E30055 catalog test is a syntax error](../learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md)
- [catalog generated tests have 3 provenance stores](../learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md)
- [verifying DIAGNOSTIC_TEST fixes](../learnings/1780352916926-verifying-slang-docs-generated-test-diagnostic-tes.md)
- [doc_section_digest backfill not trivial](../learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md)
- [catalog drift in _classify/cmd_list_stale](../learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md)
- [regenerate.py is lint, not generator](../learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md)
- [diagnostic-numbering caveat](../learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md)
- [diagnostics are Lua-driven](../learnings/1786010193246-slang-diagnostics-moved-from-slang-diagnostic-defs.md)
- [cross-file pragma warning scope breaks](../learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md)
- [warnings render as warning[ECODE]; CHECK-NOT: warning NNNNN is vacuous](../learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)
- [stdlib deprecate-and-hide two mechanisms](../learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md)
- [core-module deprecate-but-hide achievable today](../learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md)
- [Diagnostics::Unimplemented is Severity::Internal](../learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md)
- [rich diagnostic renderer zero-width EOF span](../learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md)
- [diagnostic callback API legacy severity-less](../learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md)
- [adding diagnostic type-display flag](../learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md)
- [warn→error is non-breaking](../learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)
- [newly diagnosing meaningless code is pr: non-breaking](../learnings/1790877742239-slang-pr-label-newly-diagnosing-meaningless-code-i.md) — #12992 E39026 relabeled; `check-pr-label` label-swap race.
- [pin source citations to comment text not line numbers](../learnings/1780177496970-pin-slang-source-citations-to-comment-text-or-func.md)
- [validateEntryPoint: per-param SV semantics, no aggregation (#11855)](../learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md)
- [applySettingsToDiagnosticSink double-apply clobbers; use slang-unit-test](../learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md)
- [CORRECTION: empty option set is the COMPOSITE's](../learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md)
- [hasOption(DiagnosticColor) reliable on getTargetCode composite path](../learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md)
- [adjudicate false-positive disputes by diffing emitted code](../learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md)
- [render layer already supports SourceRange](../learnings/1783523470770-slang-rich-diagnostics-render-layer-already-suppor.md)
- [#12006 E41017 false positive on export __extern_cpp globals](../learnings/1783545729206-slang-12006-e41017-false-positive-on-export-global.md)
- [#12007 E36108 'llvm' is sm_6_0 alias membership](../learnings/1783547031032-slang-12007-e36108-llvm-false-positive-is-the-sm-6.md)
- [E36110/E36108 (#12755): public impl inherits stdlib cross-target require](../learnings/1787690962502-e36110-e36108-false-positive-public-interface-impl.md) — TARGET-supported spurious vs SUB-CAP-needed legit.
- [#12755 at the witness-table check: projected-subset fix](../learnings/1787698928314-e36108-e36110-interface-conformance-false-positive.md) — strict fallback for `SLANG_TARGET_UNKNOWN`.
- [E30082 tags only scalar float→double (#12930)](../learnings/1788791945839-e30082-float-double-warning-only-tags-scalar-conve.md) — fix keys off element `BaseType`.
- [note→error: pin the SEVERITY in never-emitted code](../learnings/1792580635936-promoting-a-slang-diagnostic-note-error-pin-the-se.md) — #13809 E29103; drill on master's build.
- [E30082 literal exemption is syntactic; #11513 lexer rounding](../learnings/1793311782255-e30082-literal-exemption-is-syntactic-unsuffixed-f.md) — E40016 is the value-based precedent.
- [rich renderer drops span labels without resolvable location](../learnings/1793544034315-slang-rich-renderer-drops-span-labels-when-the-dia.md) — `parseTermString`; nameless E30015; `-diagnostic-format vs` (#14137).
_Catalog: [[wiki/index.md]]_
