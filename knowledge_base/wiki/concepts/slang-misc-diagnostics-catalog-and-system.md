---
title: "Slang Diagnostics System: Catalog, Definitions, and Rendering"
type: concept
group: slang-grab-bag
tags: [diagnostics, slang-diagnostics.lua, regenerate.py, diagnostics-catalog, warning, FileCheck, rich-diagnostics, pragma-warning, severity, Lua]
source_count: 27
---

# Slang Diagnostics System: Catalog, Definitions, and Rendering

This page covers the Slang diagnostics system from three angles: the Lua-driven definition layer, the generated catalog test infrastructure with its regenerate.py tooling, and diagnostic rendering/formatting concerns including FileCheck gotchas and the rich diagnostic renderer.

## TL;DR

- **New compiler diagnostics go in `source/slang/slang-diagnostics.lua`**, not the stale `slang-diagnostic-defs.h`. `Diagnostics::Unimplemented` is `Severity::Internal` (aborts + "file a GitHub issue") — wrong channel for user-correctable limits; use a dedicated error or `SLANG_ASSERT`. Grep the live Lua for the next-free code (branch-stacked codes go stale).
- **Slang diagnostic output is `warning[ENNNNN]:` (brackets), never `warning NNNNN`.** A `CHECK-NOT: warning 30856` passes vacuously — assert `E30856` / `[E30856]` and verify against the bug-present binary.
- **`regenerate.py` is a linter, not the generator** — `.slang` catalog tests are LLM/operator-driven. The catalog has three divergent provenance stores (`//META`, `README.md`, `freshness.json`); `mark-fresh` only touches `freshness.json`.
- **Deprecate-and-hide-from-docs = two mechanisms:** `[deprecated("msg")]` (compiler warning) + `//@hidden:` line-comment pragma (doc exclusion). Neither alone does both.
- **warn→error escalation on invalid/miscompiling code is NOT a breaking change** (breaking = breaks valid code or ABI). The in-tree mechanism is a call-site if/else picking error-struct vs warning-struct by `languageVersion`; there is no per-diagnostic warnings-as-errors knob. A 202c *error* form depends on `SLANG_LANGUAGE_VERSION_202C`, which is added only by an OPEN PR — a pure-*warning* extension needs no version atom.
- **Adjudicate a "false-positive warning?" dispute by diffing emitted target code**, not arguing intent. Run the discriminating control before relaying a plausible mechanism (E36108 'llvm' was alias-membership, not a linked-library leak).
- **API-path option bugs can't be `.slang` tests** — the CLI path is often immune. `applySettingsToDiagnosticSink` double-applies and an empty option set clobbers with defaults; the empty set is the linked *composite* component's, not the loaded module's. Write a GPU-free `slang-unit-test`.
- Worked incident case-studies are on the companion page (see below).

## Lua-Driven Diagnostic Definitions

New compiler diagnostics must be added to `source/slang/slang-diagnostics.lua`, **not** the stale `slang-diagnostic-defs.h`. The parser accepts both `[attr]` and `[[attr]]` syntax. No-arg marker attributes only require two edits (`.meta.slang` + `.h`) ([Slang diagnostics are Lua-driven (slang-diagnostics.lua), not slang-diagnostic-defs.h](wiki/learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md)).

`Diagnostics::Unimplemented` carries `Severity::Internal` which triggers `SLANG_ABORT_COMPILATION` and produces a "file a GitHub issue" message — making it inappropriate for user-correctable limitations. Use dedicated error diagnostics or `SLANG_ASSERT` instead ([Slang Diagnostics::Unimplemented is Severity::Internal — aborts compilation, wrong channel for user-actionable errors](wiki/learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md)).

Diagnostic codes cited in issues/PRs can be stale if the author's stacked branches haven't landed. Always grep the live `slang-diagnostics.lua` for the actual next-free code ([Slang shader-coverage: 64-bit counter feasibility + diagnostic-numbering caveat (issue #11452)](wiki/learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md)).

## Diagnostics Catalog: Three Provenance Stores

Generated diagnostic catalog tests have **three divergent provenance stores**: per-file `//META`, bundle `README.md`, and `freshness.json`. `regenerate.py mark-fresh` only updates `freshness.json`; hand-editing a `.slang` file requires also bumping its `//META` block manually ([Slang diagnostics-catalog generated tests have 3 divergent provenance stores; hand-fix must bump .slang META](wiki/learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md)).

The `doc_section_digest` field has inconsistent semantics (39 files share one hash, 224 have all-zero placeholders), no deterministic Python computation, and an undefined per-section anchor meaning. Naive LLM-based backfill manufactures unverifiable digests ([slang 11410 doc_section_digest backfill is not trivial — semantics underspecified, no deterministic Python computation](wiki/learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md)). Bundle-level drift detection lives in `_classify`/`cmd_list_stale`, not `cmd_verify`; per-entry diagnostic source pinning already exists at the CHECK level via lint rules, making `doc_section_digest` redundant ([slang #11410: catalog drift lives in _classify/cmd_list_stale (not cmd_verify) + per-entry CHECK-pin already exists](wiki/learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md)).

## regenerate.py Is a Linter, Not the Generator

`regenerate.py` validates and lints generated test files but **does not generate them**. Actual `.slang` test generation is LLM/operator-driven via prompt files. A warn-only lint guard scoped with `if not is_catalog:` silently misses placeholders reintroduced onto catalog files ([Slang diagnostics-catalog: regenerate.py is lint/tooling, not the generator](wiki/learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md)).

The stale E30055 catalog test uses GNU elvis syntax (`b ?: 0.0`) that Slang doesn't support, so it produces a parse error rather than silently passing. The real fix surface is the LLM generation prompt, not `slang-diagnostics.lua` ([slang #11407 stale 30055 catalog test is a syntax error, not just scalar; fix surface is the gen prompt not slang-diagnostics.lua](wiki/learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md)).

## stdlib Deprecation: Two Separate Mechanisms

To deprecate a core-module function AND hide it from generated online docs requires two independent mechanisms combined: `[deprecated("message")]` for a compiler warning and `//@hidden:` as a line comment pragma for doc exclusion. Neither alone achieves both effects ([Slang stdlib: deprecate-and-hide-from-docs = [deprecated()] + //@hidden: (two separate mechanisms)](wiki/learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md)). The `//@hidden:` token parsed is `"hidden:"` (without the `@` prefix), and ByteAddressBuffer deprecation must cover all three buffer type variants ([Slang core-module: deprecate-but-hide-from-online-docs is achievable today](wiki/learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md)).

## FileCheck Format: `warning[ECODE]` Not `warning NNNNN`

Slang diagnostic output uses the format `warning[ENNNNN]:`, **not** `warning NNNNN`. A `// CHECK-NOT: warning 30856` assertion never matches and passes vacuously, asserting nothing. Always use `CHECK-NOT: E30856` or `[E30856]` and verify by running the bug-present binary ([Slang warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous](wiki/learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)).

## Pragma Warning Scope Across Files

Each `__include`d module file gets a fresh preprocessor with `absoluteSourceLocCounter` starting at 0, causing **cross-file absolute-location collisions** in the shared `WarningStateTracker` timeline. Additionally, `addPragmaPop` restores all diagnostic IDs on pop (not just those the push/pop touched), which can shadow root-file disables ([Slang cross-file #pragma warning scope breaks via absolute-loc collision](wiki/learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md)).

## Rich Diagnostic Renderer Bugs

The rich diagnostic renderer has two known bugs: zero-width EOF spans cause last-character duplication in colored output, and codepoint-based columns are inconsistently indexed by byte offsets leading to multibyte character corruption. The duplication bug is color-path-specific ([slang rich diagnostic renderer mishandles zero-width EOF span and byte-vs-codepoint columns](wiki/learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md)).

The `SlangDiagnosticCallback` API has no severity parameter and only covers the legacy compile path. Severity data is available internally but flattened at the public boundary. The maintainer roadmap is the Rich Diagnostics rewrite rather than bolt-on additions ([Slang diagnostic-callback API: legacy + severity-less; diagnostics roadmap is the Rich Diagnostics rewrite](wiki/learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md)).

**The render layer already supports SourceRange — a range-underline feature is NOT a rendering change** (#10476). `DiagnosticSpan` is `{ SourceRange range; String message; }` and `makeLayoutSpan` already underlines the FULL range when `begin != end` (falling back to the single-token caret only when `begin == end`). The gap is entirely the AUTHORING/PLUMBING layer where a range is flattened to zero-width: the DSL `getLocationExpr` maps every typed location to ONE SourceLoc (no begin/end pair), and codegen emits `result.primarySpan.range = SourceRange{<single loc>}` (single-arg ctor makes begin==end) — that's the choke point. So the ask "span accepts a SourceRange" is a small additive DSL+codegen change (renderer untouched), while "AST/IR insts *store* SourceRange" (~668 / ~313 sites + serialization) are large cross-cutting representation changes to split into separate maintainer-designed follow-ups ([slang rich-diagnostics render layer already supports SourceRange; only authoring/plumbing collapses to one loc](wiki/learnings/1783523470770-slang-rich-diagnostics-render-layer-already-suppor.md)).

## Adding a Diagnostic Type-Display Flag

To add a multi-mode diagnostic display flag (e.g. for type-alias "aka" annotations): copy the `DiagnosticColor` option pattern, and put display-mode-dependent decoration in the diagnostics formatter (where the sink is reachable) rather than inside `Type::toText` which has no sink context ([Slang: adding a diagnostic type-display flag — DiagnosticColor template + toText has no sink context](wiki/learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md)).

## warn→error Escalation Is Non-Breaking

Escalating a warning to an error for previously-silently-miscompiling code is **not** considered a "breaking change" in Slang — breaking means breaking valid code or ABI. The maintainer reverted a `pr: breaking change` label back to `pr: non-breaking` for a `[[vk::location]]` misuse escalation ([warn→error on an invalid *misuse* can still be labeled pr: non-breaking (maintainer call, slang #6216)](wiki/learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)).

A `warn-error` on a diagnostic for invalid/miscompiling code can still carry its original warning-class label even when it becomes a hard error in certain contexts ([warn→error on an invalid *misuse* can still be labeled pr: non-breaking (maintainer call, slang #6216)](wiki/learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)).

The in-tree mechanism for warn→error-by-language-version is a call-site if/else picking the error-struct vs the warning-struct — there is NO per-diagnostic warnings-as-errors knob. The `volatile` modifier is the shape to copy (`slang-parser.cpp:10284-10296`): ERROR `RemovedModifierUsage` when `languageVersion >= SLANG_LANGUAGE_VERSION_2026`, else WARNING `DeprecatedModifierUsage` when `>= 2025`, reading `parser->currentModule->languageVersion`. The `UnintendedEmptyStatement` diagnostic (code **20101**, declared as a `warning(...)` in `slang-diagnostics.lua:979-984`) shows a related structural point: it is emitted **entirely in the parser**, not the semantic checker — `Parser::ParseStatement(Stmt* parentStmt)` fires it only when `as<IfStmt>(parentStmt)` is true, and a bare `;` parses to a fieldless `EmptyStmt` sentinel (vs `{}` → `BlockStmt`, so `as<EmptyStmt>` cleanly distinguishes a stray semicolon with no false positives on empty blocks). for/while/do/catch/defer are silent today only because those body-parse sites call `ParseStatement()` with NO parent, so threading the parent (or post-checking the returned `EmptyStmt`) at those sites is the single extension hook (#12296). Any 202c-gated *error* form of these inherits a hard dependency: `SLANG_LANGUAGE_VERSION_202C` does not exist in-tree yet (introduced by OPEN PR #12179), whereas a pure-*warning* extension needs no version atom and can ship independently ([Empty-statement lint (UnintendedEmptyStatement 20101) is a parser check keyed on parent-stmt type](wiki/learnings/1785434273353-empty-statement-lint-unintendedemptystatement-2010.md)).

## validateEntryPoint validates SV semantics per-param, with no cross-entry-point aggregation

When triaging "Slang accepts conflicting/duplicate system-value semantics" bugs (#11855 multiple depth outputs; umbrella #6319), the front-end gap is **structural**: `validateEntryPoint` validates SV semantics per-parameter with no cross-entry-point aggregation, so it can't catch a conflict that only exists when two params' semantics are considered together. Closing the gap needs an aggregation pass, not a per-case special ([Slang validateEntryPoint validates SV semantics per-param with NO cross-entry-point aggregation (#11855)](wiki/learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md)).

## C++ API compiler-options plumbing: the empty-option-set clobber (DiagnosticColor)

Setting `CompilerOptionName::DiagnosticColor = ALWAYS` via the C++ API (`SessionDesc::compilerOptionEntries`) colored only pre-codegen diagnostics; target-stage ones came out ASCII, while the CLI `-diagnostic-color always` worked for both (#11890/#11891, HEAD f490a52aa). Reusable pattern: `ComponentType::getTargetArtifact` layers diagnostic settings onto one sink from two option sets in sequence — first `linkage->m_optionSet` (has the API-set value), then the component's own `m_optionSet` — and `applySettingsToDiagnosticSink` applies the color UNCONDITIONALLY while `getIntOption` returns the *default* (AUTO) for an absent option, so the second apply from an empty set silently clobbers the first layer's ALWAYS with AUTO (which defers to `isConsole()` → no color on an in-memory blob). Fix: guard on presence, `if (options.hasOption(CompilerOptionName::DiagnosticColor))` ([Slang API compiler-options: applySettingsToDiagnosticSink double-apply clobbers with defaults; API-path bugs need slang-unit-test not .slang](wiki/learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md)). **Which set is empty:** NOT the loaded module's — `Module`'s ctor copies `linkage->m_optionSet` (`slang-module.cpp:27`), which is why module-load diagnostics ARE colored — but the linked **composite** component's, because `CompositeComponentType`'s ctor (`slang-linkable-impls.cpp:48`) does not copy linkage options and is populated only by `linkWithOptions()`; `getTargetCode` runs through that composite ([CORRECTION to #11890 diagnostic-color learning: the empty option set is the COMPOSITE component's, not the loaded module's](wiki/learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md)). This refines the earlier "hasOption is unreliable" gotcha into a **path-specific** rule: on `getEntryPointCode`, keys like Optimization are force-materialized to their default (so `hasOption(Optimization)` false-positives), but on the `getTargetCode` composite path `DiagnosticColor` is genuinely absent-vs-set, so the `hasOption` guard is a real signal — a revert-drill unit test (set K non-default via an earlier layer, assert it survives the empty layer) falsifies force-materialization cleanly ([hasOption(DiagnosticColor) IS reliable on the getTargetCode composite path (unlike Optimization on getEntryPointCode)](wiki/learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md)). **Testing:** an API-path option bug like this CANNOT be a `.slang` slang-test (the CLI color path is immune, bypassing the double-apply); write a GPU-free `slang-unit-test` that sets the option in `SessionDesc`, `loadModuleFromSourceString` a shader producing a target-stage diagnostic, calls `getTargetCode`, and asserts the returned blob contains an ANSI escape `\x1b[`.

## Warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous

Slang warnings render as `warning[ECODE]` (brackets), so a FileCheck `CHECK-NOT: warning 41012` never matches the real text and is silently vacuous — assert against the bracketed `warning[41012]` form ([Slang warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous](wiki/learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)).

## Adjudicate 'false-positive warning?' disputes by diffing emitted code

When a maintainer disputes whether a diagnostic (e.g. uninitialized-field E41021) is a real bug or spurious, the decisive, deterministic proof is to compile the divergent cases and **diff the emitted target code** — behavior in the output settles it where argument about intent does not ([1783019615446-adjudicate-false-positive-warning-disp](wiki/learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md)).

## Two Concrete False Positives on `export __global __extern_cpp` Host Globals (#11989 spinoffs)

**E41017 (uninitialized global) false-positive on host-provided globals (#12006):** `checkUninitializedGlobals` warns E41017 on `export __global __extern_cpp` globals, whose value is supplied by the host at runtime and thus have no in-module initializer by design (the documented "set a global via host code" pattern). Its exemption set covers `IRSemanticDecoration`/`IRGlobalInputDecoration`/`IRVulkanHitAttributesDecoration` but not `IRExternCppDecoration`, which belongs there. False-negative-safe by construction: the check only reaches the diagnostic when the global has NO init block AND NO `Store` use, so exempting external globals can't mask a forgotten init. Predicate-width is a maintainer call (exempt bare `IRExternCppDecoration` vs. that AND export-linkage) ([slang#12006 E41017 false-positive on export __global __extern_cpp host-provided globals](wiki/learnings/1783545729206-slang-12006-e41017-false-positive-on-export-global.md)). **E36108 'llvm' false-positive is alias-membership, not linked-library leak (#12007):** `[require(sm_6_0)]` + a GPU-only op reports "dependencies not compatible on target 'llvm'" even compiling only `-target spirv`. The prior stated mechanism ("llvm auto-available because slang-llvm is linked") is WRONG — refuted by two controls (reproduces on a Debug slangc with no libslang-llvm.so; `[require(spirv_1_3)]`+same op compiles clean). Actual cause: the `sm_6_0` alias literally lists cpp+llvm as target disjuncts, and the front-end public-decl consistency check requires the body implementable on EVERY named target disjunct; the message says `llvm` only because it's highest-ordered among the failing target atoms. Fix: narrow the `[require(spirv, sm_6_0)]` at use sites (zero-risk) vs. drop cpp/llvm from the `sm_*_version` aliases (high blast radius). Meta-lesson: run the discriminating control (`[require(spirv_1_3)]`-clean vs `[require(sm_6_0)]`-error, a 30-second test) before relaying a plausible mechanism ([slang#12007 E36108 'llvm' false-positive is the sm_6_0 alias listing cpp/llvm, NOT auto-available-because-linked](wiki/learnings/1783547031032-slang-12007-e36108-llvm-false-positive-is-the-sm-6.md)).

## Deep-Dive Incidents & Case Studies (split out)

The worked *incidents* — E36121-as-a-pre-existing-discard, proving a one-site guard fix complete, "a warning is not the end of a compile" (#8785 ICE/SIGSEGV), the severity-downgrade-receiver rule, shared-formatter golden regressions, `(Struct)0` deprecation, and the std140 source-loc drop — live on the companion page [Slang Diagnostics: Deep-Dive Incidents & Case Studies](slang-misc-diagnostics-deep-dives.md) (this page hit the 40 KB cap).

**Source learnings (27):**
- [Empty-statement lint (UnintendedEmptyStatement 20101) is a parser check keyed on parent-stmt type (fires only under IfStmt); warn→error-by-version copies the volatile-modifier if/else; 202c error form blocked on OPEN #12179](wiki/learnings/1785434273353-empty-statement-lint-unintendedemptystatement-2010.md)
- [stale E30055 catalog test is a syntax error](wiki/learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md)
- [catalog generated tests have 3 provenance stores](wiki/learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md)
- [verifying DIAGNOSTIC_TEST fixes](wiki/learnings/1780352916926-verifying-slang-docs-generated-test-diagnostic-tes.md)
- [doc_section_digest backfill not trivial](wiki/learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md)
- [catalog drift in _classify/cmd_list_stale](wiki/learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md)
- [regenerate.py is lint, not generator](wiki/learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md)
- [diagnostic-numbering caveat](wiki/learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md)
- [diagnostics are Lua-driven](wiki/learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md)
- [cross-file pragma warning scope breaks](wiki/learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md)
- [Warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous](wiki/learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)
- [stdlib deprecate-and-hide two mechanisms](wiki/learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md)
- [core-module deprecate-but-hide achievable today](wiki/learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md)
- [Diagnostics::Unimplemented is Severity::Internal](wiki/learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md)
- [rich diagnostic renderer zero-width EOF span](wiki/learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md)
- [diagnostic callback API legacy severity-less](wiki/learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md)
- [adding diagnostic type-display flag](wiki/learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md)
- [warn→error is non-breaking](wiki/learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)
- [pin source citations to comment text not line numbers](wiki/learnings/1780177496970-pin-slang-source-citations-to-comment-text-or-func.md)
- [validateEntryPoint validates SV semantics per-param with NO cross-entry-point aggregation (#11855)](wiki/learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md)
- [API compiler-options: applySettingsToDiagnosticSink double-apply clobbers with defaults; use slang-unit-test](wiki/learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md)
- [CORRECTION: the empty option set is the COMPOSITE component's, not the loaded module's](wiki/learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md)
- [hasOption(DiagnosticColor) IS reliable on getTargetCode composite path (path-specific)](wiki/learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md)
- [Adjudicate 'false-positive warning?' disputes by diffing emitted target code across divergent cases](wiki/learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md)
- [slang rich-diagnostics render layer already supports SourceRange; only authoring/plumbing collapses to one loc](wiki/learnings/1783523470770-slang-rich-diagnostics-render-layer-already-suppor.md)
- [slang#12006 E41017 false-positive on export __global __extern_cpp host-provided globals](wiki/learnings/1783545729206-slang-12006-e41017-false-positive-on-export-global.md)
- [slang#12007 E36108 'llvm' false-positive is the sm_6_0 alias listing cpp/llvm, NOT auto-available-because-linked](wiki/learnings/1783547031032-slang-12007-e36108-llvm-false-positive-is-the-sm-6.md)

_Catalog: [[wiki/index.md]]_
