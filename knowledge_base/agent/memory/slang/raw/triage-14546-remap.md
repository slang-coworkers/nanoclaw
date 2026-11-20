---
type: triage
title: "Triage: shader-slang/slang#14546 — suggest mul() for matrix*vector (remapped to maintainer design 2026-11-18)"
---

# Triage: shader-slang/slang#14546 — Diagnostics: suggest `mul()` when `*` is used between a matrix and a vector
Date: 2026-11-17, remapped 2026-11-18 | enhancement (diagnostics) | severity: low | P2 | frontend
Repro: CONFIRMED top-of-tree 2a91af5b7 (E39999 + 21 candidate notes, no `mul` hint). Duplicate: no.
MAINTAINER DIRECTION: tangent-vector, comment 6987832013 (2026-11-18 18:31Z) — design below supersedes
my original Approach A (shape-gated note inside ResolveInvoke), which he explicitly rejected as ad-hoc.
No GitHub posts authorized; fix-chain go/no-go belongs to the operator.

## What's requested
When `*` fails between a matrix and a fitting vector/matrix operand, hint `mul()`. Maintainer's
systematic design: (1) a GENERAL declaration attribute that always emits a diagnostic when the
declaration is referenced/used — in particular when overload resolution selects it as the chosen
candidate; (2) fake `operator*` overloads for the matrix-vector cases at LOW overload rank carrying
that attribute, so they are selected only when nothing else matches, making the reference an error.

## Repro (verified)
`slangc -target spirv -entry main -stage compute repro.slang` on `{float4x4 m; float4 v; o[0]=m*v;}`
→ `error[E39999]: no overload for '*' applicable to arguments of type (matrix<float,4,4>, vector<float,4>)`
+ 21 candidate notes. Under the fake-overload design this error is REPLACED by one clean
attribute error — and the 21 candidate notes disappear entirely (the fake is selected, so the
no-applicable path is never taken): the issue's secondary "fewer candidate notes" ask is solved
for these shapes as a side effect.

## The design mapped onto the code (verified at HEAD 2a91af5b7)

### Component 1 — general diagnostic-on-reference attribute
Exact generalization of the existing `[deprecated]`/`[RemovedSince]` reference-time machinery:
- Registration: one `attribute_syntax [__diagnoseOnUse(message: String)] : DiagnoseOnUseAttribute;`
  + `__attributeTarget(DeclBase)` in core.meta.slang beside deprecated (core.meta.slang:5056-5058).
  No parser change — attributes are generically parsed (slang-parser.cpp:5836-5893).
- AST: `class DiagnoseOnUseAttribute : public Attribute { String message; }` in
  slang-ast-modifier.h next to DeprecatedAttribute (:2149-2159, FIDDLE fields).
- Validation: one branch in `checkAttribute` else-if chain, slang-check-modifier.cpp:1432+, beside
  the DeprecatedAttribute branch (:1252-1263); arg validation conventions :1492-1534.
- Diagnostic: new `err` in slang-diagnostics.lua beside deprecated-usage (:3252-3257) /
  removed-usage (:3301-3306) with `~decl`, `~message`, `~location` args; err not warning
  (maintainer: "makes referring to them an error").
- Fire site (the key hook): `diagnoseDeprecatedAndRemovedDeclRefUsage`, slang-check-expr.cpp:351-435,
  invoked from the `ConstructDeclRefExpr` funnel (:512) — the same funnel through which overload
  WINNERS materialize: CompleteOverloadCandidate slang-check-overload.cpp:1644 (plain funcs) and
  createGenericDeclRef :1476 (generic winners, i.e. our inferred-arg operator calls). Verified:
  AddFuncOverloadCandidate's standard path (:2585-2616) adds candidates WITHOUT constructing refs —
  only the precomputed-funcType branch (:2638) constructs one during candidate building — so a
  plain declared fake overload is diagnosed once, at selection. Existing dedup/suppression
  (:381-407) covers repeats.
- Caveats for the fixer: (a) the helper early-returns when no lexical ModuleDecl is found — the new
  branch must not depend on languageVersion; (b) constructor selection via a TYPE reference
  (int4(...)) does not flow through decl-ref checking (comment slang-check-expr.cpp:392-394) —
  out of scope here but worth a doc comment on the attribute; (c) keep the attribute general
  (any decl kind), the fake overloads are just its first consumer.

### Component 2 — fake low-rank operator* overloads
- Where: hand-written generics in core.meta.slang next to the Lua-generated operator family
  (generator block :3194-3320 emits only scalar×scalar, vec×vec, SAME-shape m×m, scalar↔vec/matrix
  — no signature conflict with m×v / v×m / mixed-shape m×m). Alternative: hlsl.meta.slang beside
  `mul` (:14888-15078). Core-module decls are exempt from the #12162 declaration-site
  cannot-overload-builtin-operator error (isFromCoreModule; FromCoreModuleModifier on core TUs).
- Signatures (constraint: T : __BuiltinArithmeticType, core.meta.slang:425):
  - `matrix<T,N,M> * (vector<T,M> v)` → vector<T,N>, body `return mul(m, v);`
  - `(vector<T,N> v) * matrix<T,N,M>` → vector<T,M>, body `return mul(v, m);`
  - `matrix<T,R,N> * matrix<T,N,C>` → matrix<T,R,C>, body `return mul(m1, m2);`
  Each carrying `[__diagnoseOnUse("...")]` with shape-correct mul suggestion + `[OverloadRank(-N)]`.
- Rank semantics (verified, slang-check-overload.cpp:2284-2413): rank is the LAST tie-breaker among
  Applicable candidates — status → conversion cost → lookup/shadowing → implicit conv → specificity
  → export → scope → rank (:2410-2413); skipped only for explicit Generic-flavor passes
  (:2397-2403) — inferred-arg operator calls reach it (proven in practice by logical mul -1,
  hlsl.meta.slang:14890/14971/15054, and min/max -11/-12/-13 :13740-13744).
- Why the fakes never beat real code: rank cannot override conversion cost — it only decides ties.
  For same-shape m×m the builtin fast path (convertToBuiltinArithmeticOp, #11493) rewrites to a
  BuiltinOperatorExpr BEFORE resolution (fakes never consulted); even if consulted, real same-shape
  overload ties on cost and wins on rank 0 > -N. In GLSL operator scope the fast path defers matrix
  ops and the real glsl.meta.slang operator* overloads carry [OverloadRank(15)] (:231-252) — real
  wins ties against negative-rank fakes, so `-allow-glsl` / `import glsl` keeps working with NO
  false error.
- Fake-vs-fake: the three fake domains are disjoint (m×v, v×m, mixed m×m) so one shared negative
  rank is fine; only overlapping domains would need distinct ranks (min/max pattern).
- `*=`: maintainer named only `*`. `*=` resolves against `operator*=` DECLS (not desugared; table
  slang-check-overload.cpp:3490-3501), so fake operator* does not cover it. Mechanically symmetric
  follow-up if wanted (fake `operator*=` overloads); default out of scope.

## Effort / scope
~5 source files + tests: core.meta.slang (attribute_syntax + 3 fake overloads), slang-ast-modifier.h
(1 class), slang-check-modifier.cpp (1 validation branch), slang-check-expr.cpp (1 error branch),
slang-diagnostics.lua (1 err); plus `cmake -E touch` + `generate_core_module_headers` + slangc
rebuild for the core-module change. Small-to-medium PR, low risk; the attribute is reusable
infrastructure (matches "systematic way").

## Test plan (tests/diagnostics/, //DIAGNOSTIC_TEST:SIMPLE(diag=CHECK))
- mul-hint.slang: m*v → CHECK error with `mul(m, v)` text; v*m → `mul(v, m)`; mixed m1*m2 →
  `mul(m1, m2)`; one clean error per case, NO candidate-note spam.
- Negative: same-shape m1*m2 compiles (element-wise, no error); scalar*m, m*scalar, m*s compile;
  GLSL scope (`-allow-glsl`) m*v compiles with no error; `m *= v` keeps today's E39999+E40026.
- Exhaustive: the new error fires for nothing else (exhaustive diag mode).

## Open decisions for maintainer/operator
1. Attribute name (`__diagnoseOnUse`? `__errorOnUse`?) and public vs internal (`__` prefix).
2. Error always, or suppressible via existing `[allow(...)]` (AllowAttribute, slang-check-modifier.cpp:1084)
   — suppression + the mul-forwarding body would give users an opt-in `m * v`.
3. Home for the fakes (core vs hlsl meta) + concrete rank value(s).
4. `*=` coverage now or follow-up.

## Superseded approaches (kept for the record)
- A (REJECTED by maintainer): shape-gated "did you mean mul(m, v)?" standalone note inside
  ResolveInvoke after E39999 (E40026 pattern, slang-check-overload.cpp:3740-3746) — he called this
  the "very ad-hoc path ... from within type checking logic". Not dead: the E39999 surface and the
  shape logic above are identical; the difference is trigger (candidate selection vs error path).
- C (still deferred): general candidate-note reduction — moot for these shapes under the new design.

## Sources
- Subagent digests (local checkout HEAD 2a91af5b7, 2026-11-17/18); DeepWiki cross-checks (rank
  tie-breaking, deprecated reference funnel, both consistent with local reads; one conflict —
  candidate-time reference construction — resolved by direct read of AddFuncOverloadCandidate :2585).
- Wiki: fast-path/#11493/#12162 learnings (core-module exemption, GLSL-scope deferral),
  generics-overload concept page (rank precedence).
- Maintainer comment 6987832013 (tangent-vector, MEMBER, verified verbatim via API 2026-11-18).
