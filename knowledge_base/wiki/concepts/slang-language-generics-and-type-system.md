---
title: "Slang Generics & Type System"
type: concept
group: slang-language-core
tags: [generics, type-system, witness-tables, conformance, extensions, namespaces, specialization]
source_count: 32
---

# Slang Generics & Type System

Slang's type system is built around interface conformance enforced at compile time via witness tables, with generics specialized by the IR pipeline. Extensions, namespace fragments, and associated constants interact with several phase-ordering constraints that are ongoing sources of bugs.

## Generic Specialization and Inference

Slang specializes generics from argument types at the call site. A type parameter that appears **only in return position** cannot be inferred — the checker solves from index or call arguments alone ([[wiki/learnings/1781222181614-slang-generic-subscript-cannot-infer-a-return-posi.md]], [[wiki/learnings/1781222607198-correction-resourcedescriptorheap-approach-a-retur.md]]). The `E39999 "could not specialize generic"` diagnostic has an extensible failure-reason mechanism (tagged union `GenericArgumentInferenceFailure`) added in PR #11571 and extended in PR #11656 with three new focused codes (E30438 arity, E30439 unsolved param, E38029 conformance not satisfied) ([[wiki/learnings/1781684668464-slang-e39999-could-not-specialize-generic-has-an-e.md]], [[wiki/learnings/1781729215980-slang-11643-resolved-focused-generic-specializatio.md]]). Arity diagnostics must range-check against defaulted trailing parameters, not compare against total count ([[wiki/learnings/1781753229607-slang-generic-arg-arity-diagnostics-must-range-che.md]]).

The generic-arg comparison fence (`<`/`>` inside generic argument lists) is half-implemented: `>` and `>=` are already gated via `genericDepth` in `GetOpLevel`, but `<` and `<=` are not. Crucially, `genericDepth` is never reset inside `( )` sub-expressions, so the parenthesized escape hatch does not work today for already-banned operators ([[wiki/learnings/1780512896132-slang-generic-arg-comparison-fence-is-half-built-p.md]]).

`hasModifier` on generic/static methods resolves via `getDecl()` to the inner `FuncDecl`, not the wrapping `GenericDecl`, so attribute checks work on generic methods without special unwrapping ([[wiki/learnings/1780497220869-slang-hasmodifier-on-generic-static-methods-resolv.md]]).

Any-value-inference recursion (`_findDependenciesOfTypeInSet`) has only a pointer-case guard from PR #10686, not a general visited-set. A self-referencing generic used through an interface still causes a stack overflow because `IRSpecialize` operands bypass the guard ([[wiki/learnings/1780353989621-slang-any-value-inference-recursion-10686-pointer-.md]]).

## Witness Tables and Conformance

Inherited witness-table requirements live on nested tables, not the flat top-level table. `findWitnessTableEntry` in `slang-ir-util.cpp` is flat and returns null for inherited keys, causing crashes or silent misdispatch if callers do not null-guard ([[wiki/learnings/1780677948078-slang-inherited-witness-table-requirements-live-on.md]]). The fix is `findWitnessTableEntryInInheritanceClosure` which recurses into inheritance entries.

When a witness-table-set filtering walk can partially miss (N-of-M tables found), returning a partial result causes singleton-misdispatch: a surviving entry is applied to all runtime tags, including ones whose tables missed. The correct policy is to free the partial result and return `none()` so the lookup stays dynamic. Miss-handling policy differs by pipeline role: analyzer/producer sites return `false`/`none()` on miss; consumer/downstream sites must hard-assert ([[wiki/learnings/1780769309511-witness-table-set-filtering-partial-miss-is-a-sile.md]]).

`DeclaredSubtypeWitness` and `ExtractExistentialSubtypeWitness` carry identical operands but differ in Val class, and that class drives codegen: `DeclaredSubtypeWitness` → static witness table; `ExtractExistentialSubtypeWitness` → runtime `emitExtractExistentialWitnessTable`. Swapping witness class to fix type identity silently changes codegen ([[wiki/learnings/1780530677473-slang-subtype-witness-val-class-is-load-bearing-at.md]]).

`ISession::createTypeConformanceComponentType` unconditionally allocates a new conformance entry rather than looking up the existing source-declared one. `override = 0` always breaks `is`/`as` because Slang's auto-ID assignment never picks 0, guaranteeing a duplicate entry ([[wiki/learnings/1780414379429-slang-type-conformance-override-0-always-duplicate.md]]).

Associated constants fold only via `DeclaredSubtypeWitness`; other witness subclasses are not processed by `getUnspecializedLookupRec`. The declaration/signature-type access path can fail to fold not because the witness is the wrong class, but because the conformance witness table is not yet built at fold time — the fix is `ensureDecl(sub, ReadyForConformances)` before re-folding, not `resolve()`/normalize ([[wiki/learnings/1782215625162-slang-associated-constant-fold-gated-on-declaredsu.md]], [[wiki/learnings/1782224910624-slang-a-fold-over-a-concrete-declaredsubtypewitnes.md]]).

## Extensions and Namespace Scoping

Cross-fragment namespace lookup inside `extension` headers fails with E30015 (unqualified name) because the extension-first pass in `checkModule` resolves headers before `ensureAllDeclsRec` wires namespace sibling scopes. The correct fix is a `discoverNamespaceDecls` pre-pass that drives ALL module-level `NamespaceDecl`s to `ScopesWired` before the extension loop — not enclosing-only (too narrow, misses #11532) and not the full-module ensureAllDeclsRec (regresses core library texture extensions) ([[wiki/learnings/1781071107223-slang-11531-root-cause-extension-headers-resolve-n.md]], [[wiki/learnings/1781086844343-slang-11531-approach-b-core-module-safety-rests-on.md]], [[wiki/learnings/1781088865270-slang-core-module-has-a-namespace-enclosed-extensi.md]], [[wiki/learnings/1781244954865-slang-11531-11532-fix-wire-all-module-level-namesp.md]]).

The core module DOES contain namespace-enclosed extensions (`namespace linalg { extension ... }` in `hlsl.meta.slang`). Claims that the core module has no namespace-enclosed extensions are factually false and have shipped in PR descriptions ([[wiki/learnings/1781088865270-slang-core-module-has-a-namespace-enclosed-extensi.md]]).

Extension method name hints drop the type qualifier because `getNameForNameHint` has no `ExtensionDecl` case, causing unqualified SPIR-V debug names. The fix redirects to the extension's target type via `as<DeclRefType>(extensionDecl->targetType)->getDeclRef().getDecl()`. All legal extension targets (builtins, vectors, typedefs, generic structs) are nominal `DeclRefType<ContainerDecl>` — the unqualified fallback is unreachable by construction since the checker rejects non-nominal targets ([[wiki/learnings/1781199860108-slang-extension-method-name-hints-drop-the-type-qu.md]], [[wiki/learnings/1781269392733-slang-extension-name-hint-qualification-has-no-rea.md]]).

When a struct and an extension both declare the same member name, two independent policies govern resolution: direct member access prefers the non-extension decl (base silently wins via `CompareLookupResultItems`); interface dispatch front-loads the extension's member as the witness. A nested-type static member inside an extension hard-errors on ambiguity because `getParentDeclRef` checks only the immediate parent ([[wiki/learnings/1782215352976-slang-extension-same-name-member-resolution-dual-p.md]], [[wiki/learnings/1782216036396-slang-9660-extension-shadowing-design-gated-overri.md]], [[wiki/learnings/1782745012175-slang-9660-a-just-assert-it-clarity-suggestion-can.md]]). This behavior is documented as undefined and design-gated ([[wiki/learnings/1782216036396-slang-9660-extension-shadowing-design-gated-overri.md]]).

A "just assert it" clarity suggestion for an `AggTypeDecl` guard is unsafe because `InterfaceDecl : AggTypeDecl` — interface extensions pass the guard but are absent from `getCandidateExtensions` (registered before they are diagnosed-and-returned), so `indexOf` returns -1 and the assert aborts ([[wiki/learnings/1782745012175-slang-9660-a-just-assert-it-clarity-suggestion-can.md]]).

## CMake / Build System (type system adjacent)

The `if(NOT SLANG_LIB_TYPE STREQUAL "STATIC")` guard around `install(EXPORT SlangTargets)` (PR #6158) is obsolete because `slang_add_target` wraps private deps in `$<BUILD_LOCAL_INTERFACE:...>`. Removing it is safe for configure but does not fix full static linkability — `find_package(slang)` configures fine while `target_link_libraries(... slang::slang)` still fails on undefined refs ([[wiki/learnings/1780467490251-slang-6158-static-export-guard-is-now-obsolete-bui.md]], [[wiki/learnings/1780471907292-slang-static-install-find-package-configure-link-b.md]]).

## Buffer Layout and CUDA

An empty struct used as a member in a `ParameterBlock`-backed struct causes host/device layout mismatch on CUDA: reflection treats it as size 0, but the C-like emitter emits it as a real C++ member (sizeof == 1), pushing the next field's offset. The bug only surfaces when the empty struct is in the public/exported interface — `legalizeEmptyTypes` eliminates non-public empty types ([[wiki/learnings/1781713263122-empty-struct-cuda-layout-bug-only-repros-when-the-.md]]).

Per-target buffer layout (Vulkan/Metal/CUDA) can be verified without a GPU by examining `slangc -target spirv-asm` for `OpDecorate ArrayStride` and `-target metal` for packed vs plain field types ([[wiki/learnings/1780598922131-verify-per-target-slang-buffer-strides-without-a-g.md]], [[wiki/learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md]]).

## Descriptor Heap and IR Specialization

The Site 4 heap-load specialization path (`IRSPIRVLoadDescriptorFromHeap` arm in `FuncBufferLoadSpecializationCondition::doesParamWantSpecialization`) is only reachable by a deferable struct/array argument. A struct qualifies when its natural size exceeds 128 bytes or it contains array fields ([[wiki/learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md]]). The descriptor-heap unified stride feature is already supported via `-spirv-resource-heap-stride`; the open gap is a "unified max()" policy across resource types ([[wiki/learnings/1782264486800-slang-descriptor-heap-unified-stride-11718-already.md]]).

## IR Label Tests and Mangling

When an auto-generated IR-LABEL test fails after a refactor, distinguish a function rename (label not found) from an opcode change (label found but body differs). An extension ctor mangles differently than a struct ctor: `CoopVec.$init` → `%x24init`. The CHECK should anchor on the opcode, not the function label ([[wiki/learnings/1782295021483-ir-label-test-breaks-a-renamed-function-struct-ext.md]]).

## SPIR-V `abort` Intrinsic

`abort<each T>(format, args...)` takes runtime variadic args; the message struct is an `OpCompositeConstruct`, not `OpConstantDataKHR`. The shipped PR #11542 has a conformance bug: the emitted extension token is `"SPV_KHR_shader_abort"` (the Vulkan extension name) rather than the correct SPIR-V grammar token `"SPV_KHR_abort"` ([[wiki/learnings/1782251874470-correction-abort-message-is-a-runtime-composite-ru.md]]).

## Builtin-operator fast path silently bypasses user overloads (#11493)

PR #11493 (`61ad43dbc`, first in v2026.11) added `SemanticsExprVisitor::convertToBuiltinArithmeticOp` (`slang-check-expr.cpp:4605`), called from `visitInvokeExpr` at :5007 and returning at :5008 — **before** `CheckTerm`/`ResolveInvoke` (:5044). For a builtin arithmetic/comparison/bitwise/shift/unary operator on builtin scalar/vector/matrix operands it rewrites the expr to a `BuiltinOperatorExpr` and skips overload resolution entirely, so ANY user overload of a builtin operator on builtin operand types is silently ignored — no diagnostic (discussion #11840: a ~2-year-old global `operator*(float4x4,float4x4)` stopped taking precedence after upgrading 2026.9→2026.11). Since #11493's stated goal is "byte-identical codegen", silently overriding a valid in-scope user overload is an unintended semantic regression. The fast path already defers matrix operators in GLSL operator scope (:4634-4637, :4723-4730), but the analogous "defer when a non-core user `operator OP` for the operand types is in scope" case was not handled; fix direction is a *cheap* in-scope-overload check that preserves the common no-overload fast path. This is a recurring "fast path fires/declines when it shouldn't" defect class (cf. the earlier float-bitwise → E39999 decline) ([[wiki/learnings/1782894605011-slang-11493-builtin-operator-fast-path-silently-by.md]]).

---
**Source learnings (32):**
- [[wiki/learnings/1780353989621-slang-any-value-inference-recursion-10686-pointer-.md]] — Slang any-value-inference recursion: #10686 pointer guard is partial; IRSpecialize-operand path bypasses it
- [[wiki/learnings/1780414379429-slang-type-conformance-override-0-always-duplicate.md]] — slang type-conformance override=0 always duplicates the (T,I) entry
- [[wiki/learnings/1780467490251-slang-6158-static-export-guard-is-now-obsolete-bui.md]] — Slang #6158 static-export guard is now obsolete (BUILD_LOCAL_INTERFACE wrapping)
- [[wiki/learnings/1780471907292-slang-static-install-find-package-configure-link-b.md]] — Slang static install: find_package configure ≠ link (BUILD_LOCAL_INTERFACE strips private deps)
- [[wiki/learnings/1780497220869-slang-hasmodifier-on-generic-static-methods-resolv.md]] — Slang: hasModifier on generic/static methods resolves via getDecl() to inner FuncDecl
- [[wiki/learnings/1780512896132-slang-generic-arg-comparison-fence-is-half-built-p.md]] — Slang generic-arg comparison fence is half-built; parens escape hatch is broken
- [[wiki/learnings/1780530677473-slang-subtype-witness-val-class-is-load-bearing-at.md]] — Slang: subtype-witness Val-class is load-bearing at lowering (not just type identity)
- [[wiki/learnings/1780677948078-slang-inherited-witness-table-requirements-live-on.md]] — Slang inherited witness-table requirements live on nested base-interface tables
- [[wiki/learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md]] — Testing the buffer-load-arg (Site 4) heap-load specialization path
- [[wiki/learnings/1780769309511-witness-table-set-filtering-partial-miss-is-a-sile.md]] — Witness-table-set filtering: partial-miss is a silent-misdispatch trap
- [[wiki/learnings/1781071107223-slang-11531-root-cause-extension-headers-resolve-n.md]] — slang #11531 root cause: extension headers resolve names before namespace fragments reach ScopesWired
- [[wiki/learnings/1781086844343-slang-11531-approach-b-core-module-safety-rests-on.md]] — slang #11531 Approach B core-module safety rests on as<NamespaceDecl> filter
- [[wiki/learnings/1781088865270-slang-core-module-has-a-namespace-enclosed-extensi.md]] — slang core module HAS a namespace-enclosed extension (namespace linalg)
- [[wiki/learnings/1781199860108-slang-extension-method-name-hints-drop-the-type-qu.md]] — Slang extension-method name hints drop the Type. qualifier (getNameForNameHint)
- [[wiki/learnings/1781222181614-slang-generic-subscript-cannot-infer-a-return-posi.md]] — Slang generic __subscript cannot infer a return-position-only type param from coercion target (E39999)
- [[wiki/learnings/1781222607198-correction-resourcedescriptorheap-approach-a-retur.md]] — CORRECTION: ResourceDescriptorHeap Approach A (return-position generic subscript) is a dead end
- [[wiki/learnings/1781244954865-slang-11531-11532-fix-wire-all-module-level-namesp.md]] — Slang #11531/#11532 fix: wire ALL module-level NamespaceDecls before the extension-first pass
- [[wiki/learnings/1781269392733-slang-extension-name-hint-qualification-has-no-rea.md]] — Slang extension name-hint qualification has no reachable unqualified fallback
- [[wiki/learnings/1781684668464-slang-e39999-could-not-specialize-generic-has-an-e.md]] — slang E39999 "could not specialize generic" has an extensible failure-reason mechanism (PR #11571)
- [[wiki/learnings/1781713263122-empty-struct-cuda-layout-bug-only-repros-when-the-.md]] — Empty-struct CUDA layout bug only repros when the empty type is in the public/exported interface
- [[wiki/learnings/1781729215980-slang-11643-resolved-focused-generic-specializatio.md]] — slang #11643 RESOLVED — focused generic-specialization diagnostics landed (PR #11656)
- [[wiki/learnings/1781753229607-slang-generic-arg-arity-diagnostics-must-range-che.md]] — Slang generic-arg arity diagnostics must range-check against defaulted params
- [[wiki/learnings/1782215352976-slang-extension-same-name-member-resolution-dual-p.md]] — slang extension same-name member resolution — dual policy + immediate-parent tie-break gap (#9660)
- [[wiki/learnings/1782215625162-slang-associated-constant-fold-gated-on-declaredsu.md]] — slang associated-constant fold gated on DeclaredSubtypeWitness; eager tryConstantFoldDeclRef skips normalize
- [[wiki/learnings/1782216036396-slang-9660-extension-shadowing-design-gated-overri.md]] — slang#9660 extension shadowing — design-gated; override keyword already exists
- [[wiki/learnings/1782224910624-slang-a-fold-over-a-concrete-declaredsubtypewitnes.md]] — Slang: a fold over a concrete DeclaredSubtypeWitness can return symbolic because conformance table isn't built yet
- [[wiki/learnings/1782251874470-correction-abort-message-is-a-runtime-composite-ru.md]] — CORRECTION: abort message is a runtime composite (runtime args), not OpConstantDataKHR
- [[wiki/learnings/1782264486800-slang-descriptor-heap-unified-stride-11718-already.md]] — slang descriptor-heap unified stride (#11718) — already-supported extension, gap is stride policy
- [[wiki/learnings/1782295021483-ir-label-test-breaks-a-renamed-function-struct-ext.md]] — IR-LABEL test breaks: a renamed function (struct→extension) is not an opcode change
- [[wiki/learnings/1782745012175-slang-9660-a-just-assert-it-clarity-suggestion-can.md]] — slang #9660: a "just assert it" clarity suggestion can introduce an abort regression
- [[wiki/learnings/1780598922131-verify-per-target-slang-buffer-strides-without-a-g.md]] — Verify per-target Slang buffer strides WITHOUT a GPU; reflection reports natural not ScalarDataLayout
- [[wiki/learnings/1782894605011-slang-11493-builtin-operator-fast-path-silently-by.md]] — #11493 builtin-operator fast path silently bypasses user operator overloads on builtin types
_Catalog: [[wiki/index.md]]_
