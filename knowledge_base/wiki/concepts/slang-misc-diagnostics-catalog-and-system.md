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

New compiler diagnostics must be added to `source/slang/slang-diagnostics.lua`, **not** the stale `slang-diagnostic-defs.h`. The parser accepts both `[attr]` and `[[attr]]` syntax. No-arg marker attributes only require two edits (`.meta.slang` + `.h`) ([[wiki/learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md]]).

`Diagnostics::Unimplemented` carries `Severity::Internal` which triggers `SLANG_ABORT_COMPILATION` and produces a "file a GitHub issue" message — making it inappropriate for user-correctable limitations. Use dedicated error diagnostics or `SLANG_ASSERT` instead ([[wiki/learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md]]).

Diagnostic codes cited in issues/PRs can be stale if the author's stacked branches haven't landed. Always grep the live `slang-diagnostics.lua` for the actual next-free code ([[wiki/learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md]]).

## Diagnostics Catalog: Three Provenance Stores

Generated diagnostic catalog tests have **three divergent provenance stores**: per-file `//META`, bundle `README.md`, and `freshness.json`. `regenerate.py mark-fresh` only updates `freshness.json`; hand-editing a `.slang` file requires also bumping its `//META` block manually ([[wiki/learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md]]).

The `doc_section_digest` field has inconsistent semantics (39 files share one hash, 224 have all-zero placeholders), no deterministic Python computation, and an undefined per-section anchor meaning. Naive LLM-based backfill manufactures unverifiable digests ([[wiki/learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md]]). Bundle-level drift detection lives in `_classify`/`cmd_list_stale`, not `cmd_verify`; per-entry diagnostic source pinning already exists at the CHECK level via lint rules, making `doc_section_digest` redundant ([[wiki/learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md]]).

## regenerate.py Is a Linter, Not the Generator

`regenerate.py` validates and lints generated test files but **does not generate them**. Actual `.slang` test generation is LLM/operator-driven via prompt files. A warn-only lint guard scoped with `if not is_catalog:` silently misses placeholders reintroduced onto catalog files ([[wiki/learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md]]).

The stale E30055 catalog test uses GNU elvis syntax (`b ?: 0.0`) that Slang doesn't support, so it produces a parse error rather than silently passing. The real fix surface is the LLM generation prompt, not `slang-diagnostics.lua` ([[wiki/learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md]]).

## stdlib Deprecation: Two Separate Mechanisms

To deprecate a core-module function AND hide it from generated online docs requires two independent mechanisms combined: `[deprecated("message")]` for a compiler warning and `//@hidden:` as a line comment pragma for doc exclusion. Neither alone achieves both effects ([[wiki/learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md]]). The `//@hidden:` token parsed is `"hidden:"` (without the `@` prefix), and ByteAddressBuffer deprecation must cover all three buffer type variants ([[wiki/learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md]]).

## FileCheck Format: `warning[ECODE]` Not `warning NNNNN`

Slang diagnostic output uses the format `warning[ENNNNN]:`, **not** `warning NNNNN`. A `// CHECK-NOT: warning 30856` assertion never matches and passes vacuously, asserting nothing. Always use `CHECK-NOT: E30856` or `[E30856]` and verify by running the bug-present binary ([[wiki/learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md]]).

## Pragma Warning Scope Across Files

Each `__include`d module file gets a fresh preprocessor with `absoluteSourceLocCounter` starting at 0, causing **cross-file absolute-location collisions** in the shared `WarningStateTracker` timeline. Additionally, `addPragmaPop` restores all diagnostic IDs on pop (not just those the push/pop touched), which can shadow root-file disables ([[wiki/learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md]]).

## Rich Diagnostic Renderer Bugs

The rich diagnostic renderer has two known bugs: zero-width EOF spans cause last-character duplication in colored output, and codepoint-based columns are inconsistently indexed by byte offsets leading to multibyte character corruption. The duplication bug is color-path-specific ([[wiki/learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md]]).

The `SlangDiagnosticCallback` API has no severity parameter and only covers the legacy compile path. Severity data is available internally but flattened at the public boundary. The maintainer roadmap is the Rich Diagnostics rewrite rather than bolt-on additions ([[wiki/learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md]]).

## Adding a Diagnostic Type-Display Flag

To add a multi-mode diagnostic display flag (e.g. for type-alias "aka" annotations): copy the `DiagnosticColor` option pattern, and put display-mode-dependent decoration in the diagnostics formatter (where the sink is reachable) rather than inside `Type::toText` which has no sink context ([[wiki/learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md]]).

## warn→error Escalation Is Non-Breaking

Escalating a warning to an error for previously-silently-miscompiling code is **not** considered a "breaking change" in Slang — breaking means breaking valid code or ABI. The maintainer reverted a `pr: breaking change` label back to `pr: non-breaking` for a `[[vk::location]]` misuse escalation ([[wiki/learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md]]).

A `warn-error` on a diagnostic for invalid/miscompiling code can still carry its original warning-class label even when it becomes a hard error in certain contexts ([[wiki/learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md]]).

## validateEntryPoint validates SV semantics per-param, with no cross-entry-point aggregation

When triaging "Slang accepts conflicting/duplicate system-value semantics" bugs (#11855 multiple depth outputs; umbrella #6319), the front-end gap is **structural**: `validateEntryPoint` validates SV semantics per-parameter with no cross-entry-point aggregation, so it can't catch a conflict that only exists when two params' semantics are considered together. Closing the gap needs an aggregation pass, not a per-case special ([[wiki/learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md]]).

## C++ API compiler-options plumbing: the empty-option-set clobber (DiagnosticColor)

Setting `CompilerOptionName::DiagnosticColor = ALWAYS` via the C++ API (`SessionDesc::compilerOptionEntries`) colored only pre-codegen diagnostics; target-stage ones came out ASCII, while the CLI `-diagnostic-color always` worked for both (#11890/#11891, HEAD f490a52aa). Reusable pattern: `ComponentType::getTargetArtifact` layers diagnostic settings onto one sink from two option sets in sequence — first `linkage->m_optionSet` (has the API-set value), then the component's own `m_optionSet` — and `applySettingsToDiagnosticSink` applies the color UNCONDITIONALLY while `getIntOption` returns the *default* (AUTO) for an absent option, so the second apply from an empty set silently clobbers the first layer's ALWAYS with AUTO (which defers to `isConsole()` → no color on an in-memory blob). Fix: guard on presence, `if (options.hasOption(CompilerOptionName::DiagnosticColor))` ([[wiki/learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md]]). **Which set is empty:** NOT the loaded module's — `Module`'s ctor copies `linkage->m_optionSet` (`slang-module.cpp:27`), which is why module-load diagnostics ARE colored — but the linked **composite** component's, because `CompositeComponentType`'s ctor (`slang-linkable-impls.cpp:48`) does not copy linkage options and is populated only by `linkWithOptions()`; `getTargetCode` runs through that composite ([[wiki/learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md]]). This refines the earlier "hasOption is unreliable" gotcha into a **path-specific** rule: on `getEntryPointCode`, keys like Optimization are force-materialized to their default (so `hasOption(Optimization)` false-positives), but on the `getTargetCode` composite path `DiagnosticColor` is genuinely absent-vs-set, so the `hasOption` guard is a real signal — a revert-drill unit test (set K non-default via an earlier layer, assert it survives the empty layer) falsifies force-materialization cleanly ([[wiki/learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md]]). **Testing:** an API-path option bug like this CANNOT be a `.slang` slang-test (the CLI color path is immune, bypassing the double-apply); write a GPU-free `slang-unit-test` that sets the option in `SessionDesc`, `loadModuleFromSourceString` a shader producing a target-stage diagnostic, calls `getTargetCode`, and asserts the returned blob contains an ANSI escape `\x1b[`.

---
**Source learnings (25):**
- [[wiki/learnings/1780347335365-slang-11407-stale-30055-catalog-test-is-a-syntax-e.md]] — stale E30055 catalog test is a syntax error
- [[wiki/learnings/1780352287480-slang-diagnostics-catalog-generated-tests-have-3-d.md]] — catalog generated tests have 3 provenance stores
- [[wiki/learnings/1780352916926-verifying-slang-docs-generated-test-diagnostic-tes.md]] — verifying DIAGNOSTIC_TEST fixes
- [[wiki/learnings/1780354236062-slang-11410-doc-section-digest-backfill-is-not-tri.md]] — doc_section_digest backfill not trivial
- [[wiki/learnings/1780355704625-slang-11410-catalog-drift-lives-in-classify-cmd-li.md]] — catalog drift in _classify/cmd_list_stale
- [[wiki/learnings/1780358048390-slang-diagnostics-catalog-regenerate-py-is-lint-to.md]] — regenerate.py is lint, not generator
- [[wiki/learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md]] — diagnostic-numbering caveat
- [[wiki/learnings/1780493209457-slang-diagnostics-are-lua-driven-slang-diagnostics.md]] — diagnostics are Lua-driven
- [[wiki/learnings/1780594750097-slang-cross-file-pragma-warning-scope-breaks-via-a.md]] — cross-file pragma warning scope breaks
- [[wiki/learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md]] — warnings render as warning[ECODE]
- [[wiki/learnings/1780918035054-slang-stdlib-deprecate-and-hide-from-docs-deprecat.md]] — stdlib deprecate-and-hide two mechanisms
- [[wiki/learnings/1780943246982-slang-core-module-deprecate-but-hide-from-online-d.md]] — core-module deprecate-but-hide achievable today
- [[wiki/learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md]] — Diagnostics::Unimplemented is Severity::Internal
- [[wiki/learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md]] — rich diagnostic renderer zero-width EOF span
- [[wiki/learnings/1782215106250-slang-diagnostic-callback-api-legacy-severity-less.md]] — diagnostic callback API legacy severity-less
- [[wiki/learnings/1782215211806-slang-adding-a-diagnostic-type-display-flag-diagno.md]] — adding diagnostic type-display flag
- [[wiki/learnings/1782716774890-warn-error-on-an-invalid-misuse-can-still-be-label.md]] — warn→error is non-breaking
- [[wiki/learnings/1780177496970-pin-slang-source-citations-to-comment-text-or-func.md]] — pin source citations to comment text not line numbers
- [[wiki/learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md]] — validateEntryPoint validates SV semantics per-param with NO cross-entry-point aggregation (#11855)
- [[wiki/learnings/1782929205990-slang-api-compiler-options-applysettingstodiagnost.md]] — API compiler-options: applySettingsToDiagnosticSink double-apply clobbers with defaults; use slang-unit-test
- [[wiki/learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md]] — CORRECTION: the empty option set is the COMPOSITE component's, not the loaded module's
- [[wiki/learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md]] — hasOption(DiagnosticColor) IS reliable on getTargetCode composite path (path-specific)
_Catalog: [[wiki/index.md]]_
