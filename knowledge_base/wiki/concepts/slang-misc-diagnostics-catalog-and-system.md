---
title: "Slang Diagnostics System: Catalog, Definitions, and Rendering"
type: concept
group: slang-grab-bag
tags: [diagnostics, slang-diagnostics.lua, regenerate.py, diagnostics-catalog, warning, FileCheck, rich-diagnostics, pragma-warning, severity, Lua]
source_count: 21
---

# Slang Diagnostics System: Catalog, Definitions, and Rendering

This page covers the Slang diagnostics system from three angles: the Lua-driven definition layer, the generated catalog test infrastructure with its regenerate.py tooling, and diagnostic rendering/formatting concerns including FileCheck gotchas and the rich diagnostic renderer.

## Lua-Driven Diagnostic Definitions

New compiler diagnostics must be added to `source/slang/slang-diagnostics.lua`, **not** the stale `slang-diagnostic-defs.h`. The parser accepts both `[attr]` and `[[attr]]` syntax. No-arg marker attributes only require two edits (`.meta.slang` + `.h`) ([Slang diagnostics are Lua-driven (slang-diagnostics.lua), not slang-diagnostic-defs.h](../learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md)).

`Diagnostics::Unimplemented` carries `Severity::Internal` which triggers `SLANG_ABORT_COMPILATION` and produces a "file a GitHub issue" message — making it inappropriate for user-correctable limitations. Use dedicated error diagnostics or `SLANG_ASSERT` instead ([Slang Diagnostics::Unimplemented is Severity::Internal — aborts compilation, wrong channel for user-actionable errors](../learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md)).

Diagnostic codes cited in issues/PRs can be stale if the author's stacked branches haven't landed. Always grep the live `slang-diagnostics.lua` for the actual next-free code ([Slang shader-coverage: 64-bit counter feasibility + diagnostic-numbering caveat (issue #11452)](../learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md)).

## Diagnostics Catalog: Three Provenance Stores

Generated diagnostic catalog tests have **three divergent provenance stores**: per-file `//META`, bundle `README.md`, and `freshness.json`. `regenerate.py mark-fresh` only updates `freshness.json`; hand-editing a `.slang` file requires also bumping its `//META` block manually ([Slang diagnostics-catalog generated tests have 3 divergent provenance stores; hand-fix must bump .slang META](../learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md)).

The `doc_section_digest` field has inconsistent semantics (39 files share one hash, 224 have all-zero placeholders), no deterministic Python computation, and an undefined per-section anchor meaning. Naive LLM-based backfill manufactures unverifiable digests ([slang 11410 doc_section_digest backfill is not trivial — semantics underspecified, no deterministic Python computation](../learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md)). Bundle-level drift detection lives in `_classify`/`cmd_list_stale`, not `cmd_verify`; per-entry diagnostic source pinning already exists at the CHECK level via lint rules, making `doc_section_digest` redundant ([slang #11410: catalog drift lives in _classify/cmd_list_stale (not cmd_verify) + per-entry CHECK-pin already exists](../learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md)).

## regenerate.py Is a Linter, Not the Generator

`regenerate.py` validates and lints generated test files but **does not generate them**. Actual `.slang` test generation is LLM/operator-driven via prompt files. A warn-only lint guard scoped with `if not is_catalog:` silently misses placeholders reintroduced onto catalog files ([Slang diagnostics-catalog: regenerate.py is lint/tooling, not the generator](../learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md)).

The stale E30055 catalog test uses GNU elvis syntax (`b ?: 0.0`) that Slang doesn't support, so it produces a parse error rather than silently passing. The real fix surface is the LLM generation prompt, not `slang-diagnostics.lua` ([slang #11407 stale 30055 catalog test is a syntax error, not just scalar; fix surface is the gen prompt not slang-diagnostics.lua](../learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md)).

## stdlib Deprecation: Two Separate Mechanisms

To deprecate a core-module function AND hide it from generated online docs requires two independent mechanisms combined: `[deprecated("message")]` for a compiler warning and `//@hidden:` as a line comment pragma for doc exclusion. Neither alone achieves both effects ([Slang stdlib: deprecate-and-hide-from-docs = [deprecated()] + //@hidden: (two separate mechanisms)](../learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md)). The `//@hidden:` token parsed is `"hidden:"` (without the `@` prefix), and ByteAddressBuffer deprecation must cover all three buffer type variants ([Slang core-module: deprecate-but-hide-from-online-docs is achievable today](../learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md)).

## FileCheck Format: `warning[ECODE]` Not `warning NNNNN`

Slang diagnostic output uses the format `warning[ENNNNN]:`, **not** `warning NNNNN`. A `// CHECK-NOT: warning 30856` assertion never matches and passes vacuously, asserting nothing. Always use `CHECK-NOT: E30856` or `[E30856]` and verify by running the bug-present binary ([Slang warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous](../learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)).

## Pragma Warning Scope Across Files

Each `__include`d module file gets a fresh preprocessor with `absoluteSourceLocCounter` starting at 0, causing **cross-file absolute-location collisions** in the shared `WarningStateTracker` timeline. Additionally, `addPragmaPop` restores all diagnostic IDs on pop (not just those the push/pop touched), which can shadow root-file disables ([Slang cross-file #pragma warning scope breaks via absolute-loc collision](../learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md)).

## Rich Diagnostic Renderer Bugs

The rich diagnostic renderer has two known bugs: zero-width EOF spans cause last-character duplication in colored output, and codepoint-based columns are inconsistently indexed by byte offsets leading to multibyte character corruption. The duplication bug is color-path-specific ([slang rich diagnostic renderer mishandles zero-width EOF span and byte-vs-codepoint columns](../learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md)).

The `SlangDiagnosticCallback` API has no severity parameter and only covers the legacy compile path. Severity data is available internally but flattened at the public boundary. The maintainer roadmap is the Rich Diagnostics rewrite rather than bolt-on additions ([Slang diagnostic-callback API: legacy + severity-less; diagnostics roadmap is the Rich Diagnostics rewrite](../learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md)).

## Adding a Diagnostic Type-Display Flag

To add a multi-mode diagnostic display flag (e.g. for type-alias "aka" annotations): copy the `DiagnosticColor` option pattern, and put display-mode-dependent decoration in the diagnostics formatter (where the sink is reachable) rather than inside `Type::toText` which has no sink context ([Slang: adding a diagnostic type-display flag — DiagnosticColor template + toText has no sink context](../learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md)).

## warn→error Escalation Is Non-Breaking

Escalating a warning to an error for previously-silently-miscompiling code is **not** considered a "breaking change" in Slang — breaking means breaking valid code or ABI. The maintainer reverted a `pr: breaking change` label back to `pr: non-breaking` for a `[[vk::location]]` misuse escalation ([warn→error on an invalid *misuse* can still be labeled pr: non-breaking (maintainer call, slang #6216)](../learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)).

A `warn-error` on a diagnostic for invalid/miscompiling code can still carry its original warning-class label even when it becomes a hard error in certain contexts ([warn→error on an invalid *misuse* can still be labeled pr: non-breaking (maintainer call, slang #6216)](../learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)).

## validateEntryPoint validates SV semantics per-param, with no cross-entry-point aggregation

When triaging "Slang accepts conflicting/duplicate system-value semantics" bugs (#11855 multiple depth outputs; umbrella #6319), the front-end gap is **structural**: `validateEntryPoint` validates SV semantics per-parameter with no cross-entry-point aggregation, so it can't catch a conflict that only exists when two params' semantics are considered together. Closing the gap needs an aggregation pass, not a per-case special ([Slang validateEntryPoint validates SV semantics per-param with NO cross-entry-point aggregation (#11855)](../learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md)).

## C++ API compiler-options plumbing: the empty-option-set clobber (DiagnosticColor)

Setting `CompilerOptionName::DiagnosticColor = ALWAYS` via the C++ API (`SessionDesc::compilerOptionEntries`) colored only pre-codegen diagnostics; target-stage ones came out ASCII, while the CLI `-diagnostic-color always` worked for both (#11890/#11891, HEAD f490a52aa). Reusable pattern: `ComponentType::getTargetArtifact` layers diagnostic settings onto one sink from two option sets in sequence — first `linkage->m_optionSet` (has the API-set value), then the component's own `m_optionSet` — and `applySettingsToDiagnosticSink` applies the color UNCONDITIONALLY while `getIntOption` returns the *default* (AUTO) for an absent option, so the second apply from an empty set silently clobbers the first layer's ALWAYS with AUTO (which defers to `isConsole()` → no color on an in-memory blob). Fix: guard on presence, `if (options.hasOption(CompilerOptionName::DiagnosticColor))` ([Slang API compiler-options: applySettingsToDiagnosticSink double-apply clobbers with defaults; API-path bugs need slang-unit-test not .slang](../learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md)). **Which set is empty:** NOT the loaded module's — `Module`'s ctor copies `linkage->m_optionSet` (`slang-module.cpp:27`), which is why module-load diagnostics ARE colored — but the linked **composite** component's, because `CompositeComponentType`'s ctor (`slang-linkable-impls.cpp:48`) does not copy linkage options and is populated only by `linkWithOptions()`; `getTargetCode` runs through that composite ([CORRECTION to #11890 diagnostic-color learning: the empty option set is the COMPOSITE component's, not the loaded module's](../learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md)). This refines the earlier "hasOption is unreliable" gotcha into a **path-specific** rule: on `getEntryPointCode`, keys like Optimization are force-materialized to their default (so `hasOption(Optimization)` false-positives), but on the `getTargetCode` composite path `DiagnosticColor` is genuinely absent-vs-set, so the `hasOption` guard is a real signal — a revert-drill unit test (set K non-default via an earlier layer, assert it survives the empty layer) falsifies force-materialization cleanly ([hasOption(DiagnosticColor) IS reliable on the getTargetCode composite path (unlike Optimization on getEntryPointCode)](../learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md)). **Testing:** an API-path option bug like this CANNOT be a `.slang` slang-test (the CLI color path is immune, bypassing the double-apply); write a GPU-free `slang-unit-test` that sets the option in `SessionDesc`, `loadModuleFromSourceString` a shader producing a target-stage diagnostic, calls `getTargetCode`, and asserts the returned blob contains an ANSI escape `\x1b[`.

## Warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous

Slang warnings render as `warning[ECODE]` (brackets), so a FileCheck `CHECK-NOT: warning 41012` never matches the real text and is silently vacuous — assert against the bracketed `warning[41012]` form ([Slang warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous](../learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)).

## Adjudicate 'false-positive warning?' disputes by diffing emitted code

When a maintainer disputes whether a diagnostic (e.g. uninitialized-field E41021) is a real bug or spurious, the decisive, deterministic proof is to compile the divergent cases and **diff the emitted target code** — behavior in the output settles it where argument about intent does not ([1783019615446-adjudicate-false-positive-warning-disp](../learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md)).

---
**Source learnings (27):**
- [stale E30055 catalog test is a syntax error](../learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md)
- [catalog generated tests have 3 provenance stores](../learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md)
- [verifying DIAGNOSTIC_TEST fixes](../learnings/1780352916926-verifying-slang-docs-generated-test-diagnostic-tes.md)
- [doc_section_digest backfill not trivial](../learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md)
- [catalog drift in _classify/cmd_list_stale](../learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md)
- [regenerate.py is lint, not generator](../learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md)
- [diagnostic-numbering caveat](../learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md)
- [diagnostics are Lua-driven](../learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md)
- [cross-file pragma warning scope breaks](../learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md)
- [warnings render as warning[ECODE]](../learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)
- [stdlib deprecate-and-hide two mechanisms](../learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md)
- [core-module deprecate-but-hide achievable today](../learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md)
- [Diagnostics::Unimplemented is Severity::Internal](../learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md)
- [rich diagnostic renderer zero-width EOF span](../learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md)
- [diagnostic callback API legacy severity-less](../learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md)
- [adding diagnostic type-display flag](../learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md)
- [warn→error is non-breaking](../learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md)
- [pin source citations to comment text not line numbers](../learnings/1780177496970-pin-slang-source-citations-to-comment-text-or-func.md)
- [validateEntryPoint validates SV semantics per-param with NO cross-entry-point aggregation (#11855)](../learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md)
- [API compiler-options: applySettingsToDiagnosticSink double-apply clobbers with defaults; use slang-unit-test](../learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md)
- [CORRECTION: the empty option set is the COMPOSITE component's, not the loaded module's](../learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md)
- [hasOption(DiagnosticColor) IS reliable on getTargetCode composite path (path-specific)](../learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md)
- [Warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous](../learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md)
- [Adjudicate 'false-positive warning?' disputes by diffing emitted target code across divergent cases](../learnings/1783019615446-adjudicate-false-positive-warning-disputes-by-diff.md)
_Catalog: [[wiki/index.md]]_
