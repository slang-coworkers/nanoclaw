---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786741276034-4bq1u2
written_at: 2026-08-14T21:16:32.588Z
---

# Slang limited-HLSL-templates (#12550) reuse map: the "hard" template pieces already exist in generics

Triaging shader-slang/slang#12550 (tangent-vector's epic to add deliberately-limited HLSL `template<...>` as a compat feature, design in spec#61). Key finding worth reusing for any future template/generics work:

The proposal's scariest-sounding requirements are NOT net-new — they already exist in the generics machinery and should be reused, not rebuilt:
- **Argument inference / fixpoint solver**: `inferGenericArguments` (slang-check-overload.cpp:2866), `GenericArgumentSolver`/`trySolveGenericArguments` (slang-check-constraint.cpp:997/3406), `TryUnifyVals` (:3440), work-list `ConstraintSolvingState` (:1010).
- **SFINAE-like candidate rejection + buffered diagnostics ALREADY EXIST**: `OverloadResolveContext::Mode{JustTrying,ForReal}` (slang-check-impl.h:3249) — a candidate fails SILENTLY in JustTrying; `GenericArgumentInferenceFailure` (slang-check-impl.h:3114) is captured but only surfaced if it's the selected best failed candidate; discardable `DiagnosticSink tempSink(...)` (slang-check-conversion.cpp:735, slang-check-decl.cpp:7676) is the trial-check idiom.
- **Dedup of committed instances**: ASTBuilder hash-consing via `getGenericAppDeclRef` (slang-check-constraint.cpp:2808) → same args = same DeclRef; IR `activeGenericSpecializations` (slang-ir-specialize.cpp:61).
- **Parser is ~70% there**: `ParseGenericDeclImpl` (slang-parser.cpp:1747) already parses `<...>` params + defaults; HLSL dialect branch exists (`allowGLSLInput`, :100). `template` is NOT reserved (verified: `int template=3;` compiles), and `template<...>` fails at PARSE today (E20009 '>' expected, parser reads `template` as an identifier).

GENUINELY net-new (where the risk lives): (1) a template-flavored decl DISTINCT from GenericDecl so instances stay OUT of ordinary lookup + are duck-typed/checked-at-instantiation (generics are constrained/checked-before-specialization); (2) a durable committed-instance registry that clones the origin preserving its LEXICAL PARENT CHAIN — `ASTCloner::cloneSyntaxNode` (slang-ast-clone.cpp:36) does NOT preserve the parent chain (caller must re-establish via addDirectMemberDecl); (3) a specialization-TIME expansion budget — `kMaxIRInvokeLoweringRecursionDepth`=128 bounds type NESTING at lowering, not total template instantiation; (4) the same-module rejection point (earliest semantic candidate: `isDeclReachableViaExportedImports` slang-check-decl.cpp; today enforced at lowering via `isImportedDecl` slang-lower-to-ir.cpp:744) = the author's flagged spike.

Triage lesson: for an author-driven implementation EPIC with design still under spec review, "ready-for-fix vs blocked" is the load-bearing output. Verdict = DESIGN-GATED (spec#61 open, 0 review comments, not accepted) with ONE spec-independent slice that can start now (the cross-module rejection spike). Do NOT dispatch a fixer; the reuse-vs-net-new map is the value handed to whoever eventually implements it.
