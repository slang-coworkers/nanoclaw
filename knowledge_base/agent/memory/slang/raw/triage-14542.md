---
type: triage
title: "Triage: slang#14542 — inline conjunction constraint ICE (E99997 generic type constraint during lowering)"
---

# Triage: shader-slang/slang#14542 — inline conjunction constraint (`R : IA & IB`) used by a later constraint aborts with E99997 "generic type constraint during lowering"

Date: 2026-11-17 | Category: bug | Severity: medium | Priority: P2 (Normal per report) | Component: frontend (generic constraint checking) -> IR lowering | Duplicate: no (related: #9334 constraint-order conformance diagnostic — different failure mode; #9197, #6545 closed)

## What's broken
`slangc -target spirv|hlsl` aborts when a generic's inline conjunction constraint `R : IA & IB`
is needed via its NON-FIRST conjunct by a later constraint `T : IFoo<R>` where `IFoo<R : IB>`:
E99997 InternalError "unexpected: generic type constraint during lowering" = the SLANG_UNEXPECTED
fallthrough at source/slang/slang-lower-to-ir.cpp:10629 (visitGenericTypeConstraintDecl, the
comment at :10624-10627 states the violated invariant: "a generic should have set up a parameter
for any constraints as part of being lowered"). The function need not be called.

## Repro — 6-variant matrix (verified 2026-11-17 on a rebuilt ToT slangc @ 2a91af5b7; files in /workspace/agent/.repro-14542/)
Baseline: `interface IA {} interface IB {} interface IFoo<R : IB> {} void f<...>() {} RWStructuredBuffer<float> output; [shader("compute")][numthreads(1,1,1)] void main() { output[0] = 1; }`
Command: `slangc -target hlsl -entry main <file>` (abort cases identical on `-target spirv-asm`).

| Variant | Constraint shape | Result |
|---|---|---|
| abort | `f<R : IA & IB, T : IFoo<R>>` inline | E99997 (exit 254) |
| first-conjunct | `IFoo<R : IA>` + inline `R : IA & IB` | clean (exit 0) |
| reversed | `R : IB & IA` inline | clean (exit 0) |
| where-split | `f<R, T>() where R : IA where R : IB where T : IFoo<R>` | clean (exit 0) |
| where-single | `f<R, T>() where R : IA & IB where T : IFoo<R>` | E99997 — a SINGLE where clause with the conjunction ALSO aborts: the workaround must SPLIT the conjunction into separate clauses (delta vs the issue body's "all constraints in where clauses") |
| partial-split | `f<R, T : IFoo<R>>() where R : IA where R : IB` | E99997 (matches issue body) |

Real-world case from the issue: `extension<Real : __BuiltinFloatingPointType & IArithmeticAtomicable, T : IFoo<Real>> T` where `IFoo` requires both — same shape.

## Root-cause chain (verified by direct code reading; two independent subagents + DeepWiki agree)
1. Parser attaches inline constraints immediately after the parameter (source/slang/slang-parser.cpp:1793-1810, :1843):
   member order in the generic = `C_R(R:IA&IB), R, C_T(T:IFoo<R>), T`. Where clauses are parsed after the whole signature (slang-parser.cpp:2510, :2093-2113).
2. Checker flattening — `SemanticsDeclHeaderVisitor::visitGenericTypeConstraintDecl`
   (source/slang/slang-check-decl.cpp:4910-4934): rewrites `C_R.sup` to the FIRST leaf (`IA`, :4920), creates a sibling `GenericTypeConstraintConstraintDecl`... (GenericTypeConstraintDecl) `C_R2 (R:IB)` per remaining leaf (:4925-4929) and APPENDS it at the END of the member list via `parentDecl->addDirectMemberDecl` (:4930) — i.e., AFTER `C_T`. Sibling checked to SignatureChecked (:4931).
3. Checking `T : IFoo<R>` needs `R : IB`; the solver/inheritance path
   (source/slang/slang-check-inheritance.cpp:1370-1433, esp. :1431-1432) finds the appended sibling `C_R2` and builds `DeclaredSubtypeWitness(R, IB, C_R2)` as `IFoo<R>`'s hidden generic argument.
4. Lowering — `emitGenericDecl` emits hidden constraint parameters in direct-member order (source/slang/slang-lower-to-ir.cpp:13091-13134): `C_R` first, then `C_T` — BEFORE `C_R2` (last in the list). While lowering `C_T`'s sup, `_lowerSubstitutionEnv` lowers the hidden witness arg (source/slang/slang-lower-to-ir.cpp:15147-15164) -> `visitDeclaredSubtypeWitness` (:2435-2450) asks for `C_R2`'s value -> not set yet -> `emitDeclRef`/`ensureDecl` fallback (:15107-15110) lowers `C_R2` as an ORDINARY declaration -> `visitGenericTypeConstraintDecl` fallthrough: parent is a plain GenericDecl (not InterfaceDecl :10601, not interface-requirement-generic :10605-10611, not GlobalGenericParamDecl :10613) -> SLANG_UNEXPECTED at :10629.
5. NO AndType/ConjunctionType sup survives to lowering — the 2026-11-04 shared-learning hypothesis ("AndType survives unresolved") is DISPROVEN. What survives is a perfectly valid constraint decl that is simply LOWERED OUT OF EMISSION ORDER (forward-referenced). Order sensitivity falls out exactly: needed conjunct on the original `C_R` (reversed `IB & IA`, or first-conjunct use) -> emitted before `C_T` -> OK; needed conjunct on the appended sibling -> forward reference -> ICE. where-single and partial-split abort for the same reason (the rewritten/original `R : IA` constraint plus its appended sibling land after `C_T` in member order, or `C_T` inline precedes the where-appended siblings).
6. Note the SHADOWED DUPLICATE flatten block at source/slang/slang-check-decl.cpp:4938-4972 (older copy; dead for fresh conjunctions because block 1 already rewrote `sup`; it also carries the `_cachedArgsForDefaultSubstitution` invalidation at :4963-4965 that block 1 lacks — today the cache stays coherent because `getDefaultSubstitutionArgs` pre-checks constraints (source/slang/slang-check-decl.cpp:14573-14610). Any fix here should DEDUPE the two blocks.

## Candidate approaches
### Approach A: insert flattened siblings ADJACENT to the original constraint (producer fix) — RECOMMENDED
- Where: source/slang/slang-check-decl.cpp:4923-4932 (the append loop in the first flatten block).
- Behaviour delta: insert `C_R2..C_Rn` immediately after the original constraint decl instead of appending at the end -> member order `C_R:IA, C_R2:IB, R, C_T, T`; lowering always emits a constraint before anything that can reference it.
- Tradeoffs: smallest principled fix at the exact producer that creates the forward reference; inline constraints already precede their params (parser attaches them there), so consumers already tolerate interleaved constraints; dedupe the shadowed second block in the same change.
- Risk: any consumer that positionally assumes where-clause constraints come after all params — run the full test suite; watch generics/constraint and interface tests specifically.
### Approach B: order-independent lowering (two-pass constraint emission)
- Where: source/slang/slang-lower-to-ir.cpp:13091-13134 (emitGenericDecl).
- Behaviour delta: first pass pre-registers lowered values for ALL GenericTypeConstraintDecl members (via emitGenericConstraintDecl, :12967-12974), second pass emits params and hidden args.
- Tradeoffs: hardens the whole class (covers any producer that appends constraints late); consumer-side and a bigger blast radius in delicate generics lowering; per repo methodology the producer (A) is the principled layer — B alone would leave the AST ordering wart. Viable as defense-in-depth complement or if A's member-order change proves risky.
- Risk: subtle interactions with generic param numbering / substitution env ordering.
### Approach C: targeted guard in the witness path — REJECTED
- Where: source/slang/slang-lower-to-ir.cpp:2435-2450 or :15107-15110 — route a constraint decl lacking a value through emitGenericConstraintDecl.
- Rejected: consumer-side mask; hides forward references from any producer (repo methodology: do not mask; "Silent impossible-shape handling").

## Recommended path
Approach A (+ dedupe the 4938-4972 duplicate). Acceptance criteria:
- All six matrix variants compile clean (exit 0, valid output) on `-target spirv-asm` and `-target hlsl -entry main` (ideally also `-target cuda`/metal spot checks).
- Regression test added under tests/ near existing generics/constraint coverage (matrix cases incl. the where-single abort case and the issue's extension<...> real-world shape).
- Full slang-test suite green (esp. language-feature generics, interface/conformance, autodiff suites which lean on generics heavily).

## Sources
- Shared learning (2026-11-04, same bug from Discord report fknfilewalker, unfiled then): /workspace/shared/wiki/learnings/1793781619588-slang-ice-inline-conjunction-constraint-used-by-a-.md — trigger characterization confirmed; "AndType survives to lowering" hypothesis DISPROVEN by this triage (root cause = sibling append-at-end ordering).
- wiki/concepts/slang-language-core-f0909b0-generics-overload-inference.md (flatten producer location) + agent-routing-f0909b0 ICE-family triage discipline.
- Related-not-duplicate #9334 (constraint order between two declarations -> "does not conform" diagnostic, no ICE; body verified 2026-11-17); #9197 and #6545 closed.
- DeepWiki x2: checker appends siblings via addDirectMemberDecl at end; lowering binds constraint args in member-list order (second pass, after params).
- Local repro matrix at /workspace/agent/.repro-14542/ (six .slang files), run 2026-11-17.
