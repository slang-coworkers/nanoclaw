---
title: "Slang Compiler Internals: Parser, IR, Types, and Language Semantics"
type: concept
group: slang-grab-bag
tags: [parser, IRBuilder, type-interning, module-import, autodiff, SLANG_ASSERT, String, AST, DeclRefType, ThisType, source-location, lexer]
source_count: 35
---

# Slang Compiler Internals: Parser, IR, Types, and Language Semantics

This page covers internal compiler mechanics: parsing, IR builder source location stamping, type interning and dual-representation bugs, module import/re-export semantics, autodiff parameter conventions, platform macros, and runtime data structure gotchas.

## Lexer: Hex-Digit Decoder Bug

`getStringLiteralTokenValue` in `slang-lexer.cpp` has an inline hex-digit decoder that is missing `+10` for letter hex digits (a–f, A–F), causing string literals with hex escape letters to silently produce wrong byte values. Char literals use a separate correct utility ([slang-lexer.cpp has a duplicate hex-digit decoder with an off-by-ten bug](../learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md)).

## Parser: ParseDeclName Shared by Func and Var

`ParseDeclName` is shared between function and variable declarators, so `int operator+ = 10;` is silently accepted as a variable named `operator+`. Function-vs-variable disambiguation happens later at the commit point; the fix belongs at `CompleteVarDecl`, not the shared name reader ([slang ParseDeclName shared by func and var declarators accepts operator names](../learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md)).

The `parseTypeDef` function only handles the leading-array form, causing `typedef int arr[2];` (C/HLSL trailing-array form) to fail with an unexpected-integer-literal error. The principled fix is shared declarator machinery rather than patching the typedef-specific path ([Slang typedef trailing-array parse gap (parseTypeDef vs declarator machinery)](../learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md)).

## IRBuilder Source Location RAII

The `IRBuilderSourceLocRAII` wrapper in `lowerDecl` already stamps new instruction source locations from the builder stack when `createStructKey()` is called. An explicit `irFieldKey->sourceLoc = fieldDecl->loc` assignment directly after is likely redundant for in-source paths; verify empirically by deletion rather than assuming necessity ([Slang: IRBuilder source-loc RAII may already stamp struct keys — explicit sourceLoc= can be redundant](../learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md)).

## Type Interning: DeclRefType vs ThisType Dual-Representation

`ASTBuilder::getOrCreate<T>` keys on both the syntax class and operands, so `getOrCreate<ThisType>(base)` and `getOrCreate<DeclRefType>(base)` produce **distinct** `Type*` even for the same base. `DeclRefType::create` falls through to a plain `DeclRefType` for `MemberDeclRef` bases, causing the same interface `This` to exist as two distinct types ([Slang getOrCreate interns on syntax class — DeclRefType vs ThisType dual-representation bugs](../learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md)).

A narrow 2-file fix for this dual-representation bug was superseded by a 44-file maintainer PR that canonicalized the underlying `associatedtype` constraint representation. When the same logical type interns differently based on access path, suspect a representation-canonicalization gap rather than patching the single divergence site ([postmortem: shader-slang/slang#11465 superseded by PR #11368](../learnings/1781114755243-postmortem-shader-slang-slang-11465-superseded-by-.md)).

## Module Import: Re-Export Semantics and Scope Chain

`using namespace N;` is lookup-local to the declaring module and is **never re-exported** through `import`; the primary-file leak that previously worked was a bug (now fixed via `pr: breaking`). Reconciled tests must add `using ns;` to the importer rather than deleting the test ([slang #11443 verdict: using namespace is lookup-local, primary-file leak is a breaking bug-fix](../learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md)).

The `parentDecl == moduleDecl` conjunct in the module re-export filter is load-bearing via plain transitive `import` (not only `using namespace`). Imported module scopes are spliced onto the importing module's scope chain; weakening it to bare `as<FileDecl>` would cause unintended transitive import leakage ([Slang import re-export: parentDecl==moduleDecl conjunct is load-bearing via transitive import, not using-namespace](../learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md)).

Global `type_param` declarations are merged within a single module's global scope but are **not** merged across imported modules — each module's param becomes its own distinct `SpecializationParam` ([Slang global type_param names are NOT merged across module imports](../learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md)).

Precompiled `.slang-module` import triggers location-less diagnostics because IR-pass diagnostics lose file:line source location when the struct/field key is deserialized from a precompiled module. See also the regression verification note in [[wiki/concepts/slang-misc-pr-process-and-maintainer-workflow.md]].

The old `loadModuleFromIRBlob` "returns nullptr when A imports B" bug (#6557, `containerData.modules.getCount() != 1` gate) is **already fixed on ToT** — PR #7041's RIFF rewrite removed that gate entirely. Now write (`ModuleEncodingContext::encode`) stores ONLY the module's own IR/AST with imported deps recorded as file-dependency PATH references, so `A.slang-module` has ONE `smod` chunk (not two), and load (`ModuleChunk::find` = first chunk, never fails on count>1) resolves the recorded dep paths dynamically. Prove disposition with an on-ToT repro (`slangc -dump-module A.slang-module` is exactly the reporter's `loadModuleFromIRBlob` path), NOT by reading the cited (vanished) line numbers — the file moved from slang.cpp to slang-session.cpp. The actionable deliverable for a PR request on an already-fixed bug is the coverage gap: `unit-test-ir-blob.cpp`'s 8 subtests are all self-contained, so hand the fixer a regression test that registers B's blob then loads A's blob in a fresh session. General lesson: for an old module/serialization bug with a precise line pointer, check whether an intervening rewrite (`git log -S` the symbol) removed the code before investigating the cited layer ([slang#6557 loadModuleFromIRBlob-imports-module already fixed by RIFF rewrite (#7041)](../learnings/1783463091677-slang-6557-loadmodulefromirblob-imports-module-alr.md)).

An entry point returning the **associated type of an `export`/`extern` struct** crashes SPIR-V codegen (#9580, a PR #8603 regression): post-#8603 `extern struct Foo : IFoo = Impl;` resolves at link time via `IRSymbolAlias` so the entry-point return type IS the concrete struct, but the entry-point result VarLayout's type-layout is never refreshed post-link — it stays the pre-link opaque associated-type layout, so `as<IRStructTypeLayout>` returns null → assert/segfault in `createGLSLGlobalVaryingsImpl`. The intended post-link refresh (`processEntryPointVaryingParameter` → `lookupExternDeclRefType`) fires when the result is *directly* the extern struct (VARIANT 1, works) but NOT the *associated type of* an export struct (VARIANT 0, crashes). Principled fix is producer-side (rebuild entry-point result layouts post-link), not a null-guard; the reporter (@h3r2tic) already prototyped exactly this on a branch — corroborate and help land it rather than build a parallel fix ([slang#9580 assoc-type-of-export-struct entry-point return crashes — stale post-link result layout (PR #8603 regression)](../learnings/1783557222885-slang-9580-assoc-type-of-export-struct-entry-point.md)).

## Autodiff: Backward Diff Out-Parameter Convention

In reverse-mode autodiff, a differentiable `out T y` parameter becomes a **bare `in T.Differential`** in the synthesized backward function, and `bwd_diff` writes back no primal values. Forward mode shapes `out` as `out DifferentialPair<T>` carrying both primal and tangent — forward-mode intuitions do not transfer to reverse mode ([slang bwd_diff out-param convention — bare in-differential seed, no primal writeback](../learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md)).

## Scalar vs Vector Ternary Short-Circuit Semantics

A scalar-condition `?:` short-circuits by lowering to if-else control flow (design intent, target-independent), while a vector-condition `?:` does **not** short-circuit and is deprecated in favor of `select`. The language-reference doc was stale and needed correcting ([Slang `?:` short-circuit semantics + #11403 disposition (scalar short-circuits by design; vector does not)](../learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md)).

## SLANG_ASSERT and Release Build Behavior

`SLANG_ASSERT` compiles to `SLANG_ASSUME` (undefined-behavior license) in release builds — **not** a runtime check. Using it right before a pointer dereference is dangerous. Use `SLANG_RELEASE_ASSERT` to fail loudly in release builds. Narrowing an existing `SLANG_ASSERT` predicate can introduce release-only UB ([Slang: SLANG_ASSERT is a no-op (SLANG_ASSUME/UB-license) in release builds — use SLANG_RELEASE_ASSERT to actually fail loudly](../learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md)).

Using `SLANG_ASSERT=release-assert-only` when retesting an assert-failure ICE **suppresses the exact assertion** being tested, producing a false "fixed" result ([SLANG_ASSERT=release-assert-only gives FALSE 'fixed' when triaging assert-failure ICEs](../learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md)).

## Optimization Level Default

The default optimization level is `OptimizationLevel::Default` (1), not `None` (0), so `level != None` over-warns on every ordinary compile. The correct way to detect an explicitly-set `-O` flag is `CompilerOptionSet::hasOption(CompilerOptionName::Optimization)` ([Slang opt-level default is Default not None — use hasOption to detect explicit -O](../learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md)).

## Platform Macros: Value-Style, Always Defined

Slang platform macros like `SLANG_OSX`, `SLANG_LINUX`, `SLANG_VC` are **always defined** (to 0 on inactive platforms) via `slang.h`, so `#ifdef SLANG_OSX` is unconditionally true. This applies in contexts where slang.h is included; prelude headers where slang.h is absent are the exception ([Slang platform macros are value-style (always defined) — defined()/#ifdef on them is an always-true bug](../learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md)).

Converting `defined(SLANG_OSX)` to the value test `SLANG_OSX` silently drops iOS from the dlfcn branch since `SLANG_OSX` is 0 on iOS. The fix is to use the `SLANG_APPLE_FAMILY` aggregate, mirroring `SLANG_LINUX_FAMILY` on the Linux side ([Presence→value SLANG_* macro conversions can silently narrow the active-platform side (iOS dropped from dlfcn)](../learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md)).

## Slang::String Is Copy-On-Write

`Slang::String` is copy-on-write with a shallow copy constructor, making it unsafe to share across threads without a forced deep copy. The safe idiom is `String(x.getUnownedSlice())` under the producer's lock to get a uniquely-owned buffer ([Slang::String is COW — deep-copy via String(x.getUnownedSlice()) to share across threads](../learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md)).

## Initializer List Coercion: canCoerce Probe Divergence

A class of bug where brace initializers work in var-decl/return/assignment but fail as function arguments: a `return true` nested inside `if(outExpr)` in a coercion helper produces false-negatives during `canCoerce` probes (which call with `outExpr==nullptr`). The fix is to un-nest `return true` so viability is reported independently of output AST requests ([Slang init-list-as-argument bugs: check canCoerce viability-probe (outExpr==null) divergence](../learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md)). PR #11818 fixed the success-return probe safety, but the error-return path in `createInvokeExprForExplicitCtor` still calls `diagnoseRaw` to the real sink during `canCoerce` probes, leaking hard diagnostics before overload ranking completes ([slang init-list arg coercion: #11730 fixed the success return's probe-safety but the ERROR return still leaks a real-sink diagnostic during canCoerce](../learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md)).

## #language Directive Precedence

A `#language slang <ver>` directive **unconditionally overrides** the session default (in either direction), while files without the directive keep the default. The code path is in the preprocessor; CLI `-std` and cross-module behavior have specific corollaries documented ([Slang #language directive precedence: unconditional per-file override of the option-set default](../learnings/1782153228750-slang-language-directive-precedence-unconditional-.md)).

## Capability System: -capability vs [require]

The `-capability` command-line flag only affects target-compatibility checking (stage 2), not function self-consistency checking (stage 1). Public functions must declare `[require(...)]` explicitly; the flag cannot widen that declaration ([Slang `-capability` does not silence 'use of undeclared capability' — it's a per-function contract](../learnings/1779907427493-slang-capability-does-not-silence-use-of-undeclare.md)).

`[require]` attribute drops capabilities via a silent runtime-divergence (SS-class severity) — the missed-emit causes runtime-divergent behavior for capabilities that gate codegen decisions like path selection and SPIR-V versioning, while usage-driven caps are unaffected ([slang#11631 severity: [require]-drop is a SILENT runtime-divergence (SS-class), and only hits codegen-DECISION caps](../learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md)).

## MemoryScope Machinery Exists but Is Unwired

Slang already has `MemoryScope` enum, IR attribute, and coherent-buffer emit wiring, but all atomic operations hard-code `SpvScopeDevice`. Exposing atomic scope would be pure plumbing (add `IRMemoryScopeAttr` decoration to atomic insts) reusing existing representation ([Slang MemoryScope machinery exists but is unwired to atomics (issue #6970)](../learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md)).

## Lexer: escape validation belongs in the decode layer, not the scan pass

Escape-sequence *interpretation* in the Slang lexer is deferred and context-dependent: `getStringLiteralTokenValue` decodes escapes for real string values, but `getFileNameTokenValue` returns the **raw** quoted content and deliberately never processes escapes (`\` is a valid Windows path separator). Regression #11829 landed because PR #11714 added escape *validation* (`\u`/`\U` digit-count → E10007/E10008) into the token **scanning** pass, making it universal before a token's downstream role is known — so it fired on `#include "dir\utility\f.slangh"` paths. The principle: escape *validation* must ride the decode layer that interprets escapes, so consumers that opt out of interpretation (file-name paths) also opt out of validation ([Lexer escape-validation must be deferred to the decode layer, not the scan pass (#include paths opt out)](../learnings/1782799753646-lexer-escape-validation-must-be-deferred-to-the-de.md)).

## Synthesized member storage added after ctor-signature collection needs its own initExpr

When the front-end synthesizes a hidden storage member **after** the constructor signature is collected — e.g. the bitfield backing word `$bit_field_backing_N` created in `SemanticsDeclAttributesVisitor` — that member needs its own `initExpr`, otherwise it is left uninitialized in the synthesized ctor ([Synthesized struct storage added after ctor-signature collection needs its own initExpr](../learnings/1782847970010-synthesized-struct-storage-added-after-ctor-signat.md)). Related: the `IDefaultInitializable` synthesis loop is off for bitfield structs, and a raw literal beats `DefaultConstruct` for backend-robust zero-init ([Slang synthesized-member init: IDefaultInitializable loop is off for bitfield structs; raw literal beats DefaultConstruct for backend-robust zero](../learnings/1782847433081-slang-synthesized-member-init-idefaultinitializabl.md)).

## Terminal count/sentinel enums: keep them IMPLICIT; static_asserts aren't uniqueness guards

When a trailing `CountOf`/`Count`/`NUM_*` sentinel enumerator collides with a real option (#11852: `CompilerOptionName::CountOf == SPIRVUnifiedDescriptorHeapStride == 154`), the durable fix is to restore **textual order == value order** and keep the sentinel *implicit* rather than pinning it explicitly ([Terminal count/sentinel enums: prefer keeping them IMPLICIT, not explicit+static_assert](../learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md)). An implicit `CountOf` can silently alias an option when a concurrent-PR renumber breaks textual value-order — a subtle follow-on to the enum-collision hazard that survives the usual fix ([Implicit CountOf sentinel aliases an option when a concurrent-PR renumber breaks textual value-order](../learnings/1782853815255-implicit-countof-sentinel-aliases-an-option-when-a.md)). And a `static_assert(CountOf == SomeNamedOption + 1)` guard is **not** a uniqueness guard: it only checks adjacency to one named enumerator, not the general "CountOf is unique" invariant ([Sentinel static_assert pinned to a named option is not a uniqueness guard](../learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md)).

## vk::binding parameter-binding predicates: single-kind guards are correct-but-fragile

A cluster of regressions from #11712 in `slang-parameter-binding`: the `vk::binding` entry-point diagnostic predicate keys off an AST type that must match the binder's layout-kind contract ([vk::binding entry-point diagnostic predicate (AST-type) must match binder's layout-kind contract](../learnings/1782864612564-vk-binding-entry-point-diagnostic-predicate-ast-ty.md)); the same predicate misfires on a struct-of-resources entry param (#11861, a mirror of #11857) ([slang #11861 — vk::binding on struct-of-resources entry param: mirror of #11857, same predicate](../learnings/1782871594193-slang-11861-vk-binding-on-struct-of-resources-entr.md)). More generally, single-kind exclusion guards (e.g. `InputAttachmentIndex` falsely reserving descriptor set 0 because it lowers to `OpDecorateInputAttachmentIndex` and is not a descriptor set) are correct but fragile — reviewers reliably ask for a shared predicate covering all the non-descriptor-set kinds ([Single-kind exclusion guards in slang-parameter-binding are correct-but-fragile; reviewers reliably ask for a shared predicate](../learnings/1782879563848-single-kind-exclusion-guards-in-slang-parameter-bi.md)).

## Record/replay stream is fixed-schema at the call level

In Slang's record/replay layer (`source/slang-record-replay/`), the recorded stream is **fixed-schema at the call level** even though each value carries a TypeId tag. On playback `executeNextCall` re-invokes the same call shape, so you must **never conditionally skip `RECORD_OUTPUT`** — a skipped output desynchronizes the stream for every subsequent call ([Record/replay stream is fixed-schema at the call level — never conditionally skip RECORD_OUTPUT](../learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md)).

## AST expr classification: order `as<derived>` before `as<base>`

In `source/slang/slang-ast-expr.h`, `VarExpr`, `MemberExpr`, and `StaticMemberExpr` all derive from `DeclRefExpr` (and `DerefMemberExpr` from `MemberExpr`); `IndexExpr` derives directly from `Expr`. Because `as<Base>` matches a derived instance, any `as<>`-cascade that classifies expressions **must test the most-derived type first** — putting `as<DeclRefExpr>` before `as<MemberExpr>` makes the MemberExpr branch dead code and swallows every member access, seeing only the field's own `declRef` and losing the base object. This was the exact ordering bug behind the E30051 false-positive alias in `_exprsDefinitelyAlias` (`slang-check-expr.cpp`, introduced by PR #11151): `a.x` and `b.x` were judged to alias because both name field `x` ([Slang AST: MemberExpr/VarExpr/StaticMemberExpr derive from DeclRefExpr — order as&lt;derived&gt; before as&lt;base&gt;](../learnings/1782898009300-slang-ast-memberexpr-varexpr-staticmemberexpr-deri.md)). Triage technique: when static reading of the AST-node types contradicts observed behavior, run cheap empirical discriminators (same field / different base vs. different field / same base) before trusting your read — and note `-dump-ast` is unmaintained.

## Modifier list is reverse-declaration order; `findModifier` returns the last-written attribute

`findModifier<T>()` (`slang-ast-base.h:737`) returns the *first* element of the decl's modifier linked list, but Slang builds that list in **reverse declaration order** — so first-in-list is the **last-written** source attribute. Empirically, three stacked `[numthreads(...)]` attributes emit the LAST one's `LocalSize`, so any "which duplicate/conflicting modifier wins" reasoning must be verified empirically, not assumed from source order ([Slang stores modifiers in reverse-declaration order; findModifier returns the last-written attribute](../learnings/1782905768996-slang-stores-modifiers-in-reverse-declaration-orde.md)). Related (issue #11881): duplicate `[numthreads]` is genuinely undiagnosed because `NumThreadsAttribute` is absent from `getModifierConflictGroupKind()` (falls to `default: NodeBase`), so the duplicate-modifier loop never fires; adding a `case ASTNodeType::NumThreadsAttribute` reuses the existing error E31202 — but watch the layout-synthesized `NumThreadsAttribute` added after the conflict loop.

## `validateEntryPoint` system-value validation: dedup keying, VS→GS false positive, output binding space

The front-end entry-point validator (`validateEntryPoint`/`validateSystemValueSemantic`, `slang-check-shader.cpp`) validates each param's SV semantic in isolation with **no cross-param aggregation** — the shared gap behind several checks. Two complementary duplicate-detection concerns share this function and neither subsumes the other: #6319 is an **exact duplicate** (same SV name+index+direction on 2+ params), while PR #11863 handles **overlap** (distinct depth-output names lowering to the same builtin) — an independent #6319 PR only textually conflicts with #11863's aggregation block and must coordinate the new diagnostic code ([slang #6319 dedup: PR #11863 is related-not-duplicate; duplicate-SV vs depth-overlap are complementary checks](../learnings/1782900707997-slang-6319-dedup-pr-11863-is-related-not-duplicate.md)). A duplicate-SV diagnostic must fire for **system values only** (the post-linking `fixFieldSemanticsOfFlatStruct` legitimately re-indexes overlapping *user* semantics) and its collision key's **output binding space** is the hard part: classic stages use an empty space key, mesh keys by output CATEGORY (not parameter position), and geometry keys by the STREAM PARAMETER — with a landmine that `inout TriangleStream<T>` streams get double-collected (input+output call both force-resolve to Output) → spurious self-collision unless the InOut branch skips output-only-by-type params ([Entry-point duplicate system-value check: output-binding-space keying (mesh=category, geometry=per-stream) + inout-stream double-collection hazard](../learnings/1782911038880-entry-point-duplicate-system-value-check-output-bi.md)). Distinct from these: the E38052 "vertex shader has no output with SV_Position" warning (PR #10971) is an **intentional heuristic false-positive** — it's gated only on `stage == Vertex` with no pipeline-pairing awareness, and its in-code comment explicitly names the VS→GS/tess/mesh case as legitimate-but-undetected, with `-warnings-disable 38052` as the documented escape hatch. So E38052 on a VS→GS shader is known and intentional, not a clear bug ([E38052 VS-missing-SV_Position is an intentional heuristic false-positive (VS→GS is known-legit)](../learnings/1782910937014-e38052-vs-missing-sv-position-is-an-intentional-he.md)).

## SV_Target location fix lives in TWO places in slang-parameter-binding

When making a fragment `SV_Target<N>` output derive its GLSL/SPIR-V `layout(location=N)` from the render-target index (#11944), note the VarLayout resource `index` is set in **two** distinct places in `slang-parameter-binding.cpp` — patch both, or the location is right in one path and stale in the other ([SV_Target location fix lives in TWO places in slang-parameter-binding.cpp](../learnings/1783263604045-sv-target-location-fix-lives-in-two-places-in-slan.md)).

## HitObject fix landed as ABI gap — see SPIR-V page

The HitObject SM6.9+NVAPI investigation (premise-refutation + 2-arg Invoke ABI gap) is synthesized on the SPIR-V backend page; cross-referenced here because the ABI surface touches core codegen decisions.

## Binary-module up-to-date check is digest-based; the #11918 cross-drive cache miss

Slang's binary-module up-to-date check is **digest-based, not mtime-based** ([1783028515295-slang-binary-module-up-to-date-check-i](../learnings/1783028515295-slang-binary-module-up-to-date-check-is-digest-bas.md)). The Windows-only #11918 cross-drive cache MISS was investigated through several corrections: the reproducer first refuted the naive path-layer hypothesis ([1783029316997-slang-11918-cross-drive-module-cache-m](../learnings/1783029316997-slang-11918-cross-drive-module-cache-miss-reproduc.md)); a correction said the load side is drive-agnostic and `getRelativePath` is save-side only ([1783029497134-correction-to-11918-learning-load-side](../learnings/1783029497134-correction-to-11918-learning-load-side-path-layer-.md)); that was then **superseded** — the `getRelativePath` cross-volume EMPTY-dep IS the root cause (save produces an empty dep, load consumes it) ([1783031868902-supersedes-prior-11918-correction-the-](../learnings/1783031868902-supersedes-prior-11918-correction-the-getrelativep.md)), confirmed RESOLVED by PR #11921 ([1783038802019-slang-11918-resolved-getrelativepath-r](../learnings/1783038802019-slang-11918-resolved-getrelativepath-returns-empty.md)). A model chain worth reading end-to-end for how corrections supersede.

## record-replay REPLAY path leaks: ReplayContext registries are raw/non-owning

The record-replay *replay* path leaks (LSan direct leaks, #11936) because `ReplayContext` registries are raw/non-owning — DeepWiki wrongly describes them as owning, so verify against the source ([1783073842766-slang-record-replay-the-replay-path-le](../learnings/1783073842766-slang-record-replay-the-replay-path-leaks-because-.md)).

## miniz heap-archive buffers are owned by per-archive callbacks, not global mz_free

A buffer from miniz's `mz_zip_writer_finalize_heap_archive(&archive, &buf, &size)` must be freed with the **archive's own** deallocator (`archive.m_pFree`), not global `mz_free` — they can differ ([1783064260282-miniz-heap-archive-buffers-are-owned-b](../learnings/1783064260282-miniz-heap-archive-buffers-are-owned-by-per-archiv.md)).

## macOS hidden visibility breaks cross-dylib typed C++ exception catch

On macOS, hidden visibility breaks catching a `Slang::Exception`/`InternalError` BY TYPE across dylibs — libc++abi relies on RTTI *identity*, which hidden visibility duplicates, so a typed `catch` in another dylib silently misses ([1783011716114-macos-hidden-visibility-breaks-cross-d](../learnings/1783011716114-macos-hidden-visibility-breaks-cross-dylib-typed-c.md)).

## Empty-Struct Legalization: Confine the Fix to the Legalization Layer, Not a Global Field-Removal Pass

An empty `struct` used as a **member** inside a public/layout-decorated struct (e.g. a `ParameterBlock<CallData>` element) crashes on CUDA/CPU (#8125): `IREmptyTypeLegalizationContext::isSimpleType` deliberately RETAINS an empty type carrying `LayoutDecoration`/`PublicDecoration`/`ExternCpp`/`HLSLExport`, and on C/C++/CUDA *source* targets that retained empty member emits as a real 1-byte C++ member while type-layout gives it size 0 → reflection puts the next field at offset 0, emitted struct puts it 1 byte later → host/device offset mismatch. The "obvious" fix — a global pass removing empty-struct fields on the C-like emit path (PR #11657 `removeEmptyStructFields`) — was **CI-rejected and closed**: a global removal also strips the zero-size empties that `Conditional<T,false>`/`Optional` rely on in dynamic-dispatch AnyValue/existential payloads (`layout-conditional-field.slang.4 (cpu)` aborts `non-simple operand(s)!`). Correct direction (jkwak's steer): confine the fix to the existing `IREmptyTypeLegalizationContext` layer, reconciling the retained-public empty *member* with the reflected size-0 layout WITHOUT touching the interface empties dynamic dispatch needs — `layout-conditional-field.slang` is the discriminating regression guard that MUST stay green. General takeaway: an empty-struct-field change is NOT safe to do globally; empty structs double as zero-size payload members of `Conditional`/`Optional` ([slang#8125 empty-struct fix — global field-removal pass is CI-rejected, fix belongs in empty-type legalization](../learnings/1783473465864-slang-8125-empty-struct-fix-global-field-removal-p.md)).

## Descriptor-heap [noinline] texture params: reuse the hoistable heap global

Approach-A fix for descriptor-heap `[noinline]` texture params (#11498, root cause of #11496, fixed in PR #11502): **reuse the hoistable heap global** rather than parameterizing the texture through the noinline boundary ([1780769595819-approach-a-fix-for-descriptor-heap-noi](../learnings/1780769595819-approach-a-fix-for-descriptor-heap-noinline-textur.md)).

---

## IR Type-Legalization Quadratic (#12040)

`IRTypeLegalizationPass` (`slang-ir-legalize-types.cpp`) is O(N^2) on straight-line functions via two compounding mechanisms: the per-round `resetScratchDataBit(module->getModuleInst(), ...)` is INSIDE the round loop (@3819) and walks the whole module each round (O(module) x O(rounds)); and re-queueing is gated only on presence-on-worklist, never on whether an operand's legalized value actually *changed*, with no already-processed early-out -- so on a dependence chain the ready-frontier advances ~O(1)/round, giving O(N) rounds x O(N). All three lowering variants route through the same `legalizeTypes`->`processModule`, so one fix (author's own: re-queue only on a real operand-value change; drop the per-round full-module bit reset) covers all invocations -- the load-bearing correctness point is that the "changed" predicate MUST treat inst replacement and struct->tuple splitting as a change ([slang#12040 IR type-legalization O(N^2) root cause](../learnings/1783674869932-slang-12040-ir-type-legalization-o-n-root-cause-is.md)).

## Half Double-Rounding: Conversions Are the Hazard, Not Arithmetic (#12042)

For CPU/C++ `half`, basic arithmetic (+ - * /) via `float` is provably benign for normalized results (Figueroa's 2q+2 threshold: q=11 gives 24 bits = float's exactly-24 significand), so don't over-scope a fix there -- the load-bearing exposure is CONVERSIONS and LITERALS. The front-end literal path rounds a `double` directly to half via `_truncateDouble` (round-to-even, `slang-lexer.cpp:1335`), NOT through `float`; the genuine float-intermediate double-rounding is the runtime prelude `struct half` (only `explicit half(float)`, no `half(double)`). A native-fp16 fast path already exists behind `FLT16_MIN`/`__STDCPP_FLOAT16_T__`; `struct half` is only the fallback. Flagged risk for a stdlib-`std::float16_t` route: cross-build-host non-determinism unless the fallback is bit-identical ([slang#12042 half double-rounding -- arithmetic benign, conversions are the hazard](../learnings/1783677064766-slang-12042-half-double-rounding-arithmetic-benign.md)).

## Enum-Cast Lowering Gate: Gate on Ops, Not Just the Type (#12048/#12050)

`enum : uint -> int` casts abort at emit with E99999 on all targets because `calcRequiredLoweringPassSet` (`slang-emit.cpp:436`) sets `enumType=true` ONLY for `kIROp_EnumType`, not the cast opcodes. The trap: an enum-typed *local* holding a compile-time constant gets SSA/const-folded away along with the last `IREnumType` reference, leaving a degenerate `CastEnumToInt` on tag-typed operands with no live EnumType to trigger the pass, so `lowerEnumType` is skipped and the stranded cast reaches emit ([slang enum->int cast E99999: lowerEnumType gated only on EnumType, not cast ops](../learnings/1783700480198-slang-enum-int-cast-e99999-lowerenumtype-gated-onl.md)). The principled fix adds the enum-cast opcodes to the gate switch (precedent: `taggedUnion` flags on all its ops). Reviewing the fix (#12050), the completeness argument is precise: opcode-only gating on {EnumType + 3 casts} IS complete because a live enum-typed value keeps the hoistable `IREnumType` alive as a module child; and the `Constexpr*` enum casts are safe to exclude because they're produced ONLY in IntVal contexts (`emitConstexprCast` from `visitTypeCastIntVal`) and `lowerEnumType` has no case for them (flagging would schedule a pass that can't lower them) -- the correct safety argument is "IntVal-context-only production", not the imprecise "SCCP folds them" ([enum-cast lowering gate -- completeness reasoning](../learnings/1783706489119-slang-enum-cast-lowering-gate-calcrequiredlowering.md)). General lesson: any pass gated on a TYPE opcode is fragile; const-folding can delete the type while leaving an op that still needs the pass.

## DescriptorHandle Per-Use Reload (#12051)

`DescriptorHandle<T>` descriptors re-load on every use (a handle sampled in a loop reloads each iteration). Two independent mechanisms, both confirmed by source Read: `shouldDuplicateInstAtUseSite()` (`slang-ir-util.cpp:2634`) hard-codes `CastDescriptorHandleToResource -> true`, and the descriptor cast/load ops are NOT `hoistable` in `slang-ir-insts.lua` (so IRBuilder's GVN dedup never collapses repeated identical loads). But `hoistable=true` is the WRONG lever (it means module-global GVN, not per-loop LICM); the right levers are relaxing `shouldDuplicateInstAtUseSite` for dominating loop-invariant casts and/or enabling `hoistLoopInvariantInsts` for these ops ([slang#12051 DescriptorHandle reloads every use -- root cause](../learnings/1783705209384-slang-12051-descriptorhandle-reloads-every-use-roo.md)). A same-day CORRECTION overturned an earlier "HLSL can't pin" inference: an empirical `slangc -target hlsl` repro showed resource-typed locals ARE storable and reusable on HLSL today -- hoisting the conversion into a local before the loop emits `ResourceDescriptorHeap[i]` once; the per-use reload only happens when the conversion is written per-use. So the asymmetry is real (SPIR-V's `CastDescriptorHandleToResource` IS force-duplicated by design; HLSL is not), and #11798 (input-syntax via `UntypedResourceHandle`) does NOT close #12051. The meta-lesson: for any cross-target codegen claim, EMIT AND GREP before asserting -- source-path reading establishes the mechanism but not the observable output shape ([CORRECTION #12051: DescriptorHandle reuse ALREADY works on HLSL via a local](../learnings/1783724965975-correction-slang-12051-descriptorhandle-reuse-alre.md)).

## Entry-Point Layout Fixes Belong in the Front-End (#9580/#10030)

For entry-point / varying-parameter / reflection *layout* fixes, the resolution must happen at the front-end AST level *before* entry-point layout generation, NOT via a back-end IR post-link layout rebuild, which is "wrong by construction" per Slang conventions (a parallel IR layout path has no consistency guarantee against AST-computed core layout). Verified on PR #10030 (fix for #9580): tangent-vector's CHANGES_REQUESTED and csyonghe's comment both reject the IR approach and call for a front-end resolution step, and the github-actions bot's nits were all hardening the *wrong* (back-end) path. Our own triage-9580 had recommended exactly that rejected Approach A; default the recommendation to a front-end AST resolution step and only propose a back-end IR transform if a maintainer explicitly asks ([Slang entry-point layout fixes must be front-end (AST), not back-end IR rebuild](../learnings/1783710345558-slang-entry-point-layout-fixes-must-be-front-end-a.md)).

<!-- fold-20260711 -->

**Source learnings (59):**
- [lexer hex-digit decoder bug](../learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md)
- [capability flag vs [require]](../learnings/1779907427493-slang-capability-does-not-silence-use-of-undeclare.md)
- [bwd_diff out-param convention](../learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md)
- [scalar short-circuits, vector does not](../learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md)

- [IRBuilder source-loc RAII may already stamp](../learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md)
- [using namespace is lookup-local](../learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md)
- [import re-export parentDecl==moduleDecl conjunct](../learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md)
- [getOrCreate interns on syntax class](../learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md)
- [postmortem: ThisType/DeclRefType superseded by canonicalization](../learnings/1781114755243-postmortem-shader-slang-slang-11465-superseded-by-.md)
- [typedef trailing-array parse gap](../learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md)
- [global type_param names not merged across imports](../learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md)
- [[require]-drop is silent runtime-divergence](../learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md)
- [SLANG_ASSERT release-assert-only false fixed](../learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md)
- [SLANG_ASSERT is a no-op in release](../learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md)
- [opt-level default is Default not None](../learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md)
- [ParseDeclName shared by func and var](../learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md)
- [#language directive precedence](../learnings/1782153228750-slang-language-directive-precedence-unconditional-.md)
- [MemoryScope machinery exists but unwired](../learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md)
- [platform macros are value-style](../learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md)
- [presence→value macro conversions drop iOS](../learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md)
- [Slang::String is COW](../learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md)
- [init-list arg bugs canCoerce divergence](../learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md)
- [init-list arg coercion #11730 fixed success but error path leaks](../learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md)
- [Lexer escape-validation must be deferred to the decode layer, not the scan pass (#include opts out)](../learnings/1782799753646-lexer-escape-validation-must-be-deferred-to-the-de.md)
- [Synthesized-member init: IDefaultInitializable loop off for bitfield structs; raw literal beats DefaultConstruct](../learnings/1782847433081-slang-synthesized-member-init-idefaultinitializabl.md)
- [Synthesized struct storage added after ctor-signature collection needs its own initExpr](../learnings/1782847970010-synthesized-struct-storage-added-after-ctor-signat.md)
- [Implicit CountOf sentinel aliases an option when a concurrent-PR renumber breaks textual value-order](../learnings/1782853815255-implicit-countof-sentinel-aliases-an-option-when-a.md)
- [Sentinel static_assert pinned to a named option is not a uniqueness guard](../learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md)
- [Terminal count/sentinel enums: prefer keeping them IMPLICIT, not explicit+static_assert](../learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md)
- [vk::binding entry-point diagnostic predicate (AST-type) must match binder's layout-kind contract](../learnings/1782864612564-vk-binding-entry-point-diagnostic-predicate-ast-ty.md)
- [slang #11861: vk::binding on struct-of-resources entry param — mirror of #11857, same predicate](../learnings/1782871594193-slang-11861-vk-binding-on-struct-of-resources-entr.md)
- [Single-kind exclusion guards in slang-parameter-binding are correct-but-fragile; reviewers ask for a shared predicate](../learnings/1782879563848-single-kind-exclusion-guards-in-slang-parameter-bi.md)
- [Record/replay stream is fixed-schema at the call level — never conditionally skip RECORD_OUTPUT](../learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md)
- [AST MemberExpr/VarExpr/StaticMemberExpr derive from DeclRefExpr — order as<derived> first](../learnings/1782898009300-slang-ast-memberexpr-varexpr-staticmemberexpr-deri.md)
- [Modifier list is reverse-declaration order; findModifier returns last-written; [numthreads] dup undiagnosed](../learnings/1782905768996-slang-stores-modifiers-in-reverse-declaration-orde.md)
- [#6319 duplicate-SV vs #11863 depth-overlap are complementary validateEntryPoint checks](../learnings/1782900707997-slang-6319-dedup-pr-11863-is-related-not-duplicate.md)
- [Entry-point duplicate-SV check: output-binding-space keying + inout-stream double-collection hazard](../learnings/1782911038880-entry-point-duplicate-system-value-check-output-bi.md)
- [E38052 VS-missing-SV_Position is an intentional heuristic false-positive (VS→GS known-legit)](../learnings/1782910937014-e38052-vs-missing-sv-position-is-an-intentional-he.md)
- [SV_Target location fix lives in TWO places in slang-parameter-binding.cpp (#11944)](../learnings/1783263604045-sv-target-location-fix-lives-in-two-places-in-slan.md)
- [Binary-module up-to-date check is DIGEST-based (not mtime); path layer has no cross-drive handling](../learnings/1783028515295-slang-binary-module-up-to-date-check-is-digest-bas.md)
- [#11918 cross-drive module-cache MISS: reproducer refutes the naive path-layer hypothesis](../learnings/1783029316997-slang-11918-cross-drive-module-cache-miss-reproduc.md)
- [CORRECTION to #11918: load-side path layer is drive-agnostic; getRelativePath is save-side only](../learnings/1783029497134-correction-to-11918-learning-load-side-path-layer-.md)
- [SUPERSEDES #11918 correction: getRelativePath cross-volume EMPTY-dep IS the root cause](../learnings/1783031868902-supersedes-prior-11918-correction-the-getrelativep.md)
- [#11918 RESOLVED: getRelativePath returns empty across Windows volumes → empty serialized module dep (PR #11921)](../learnings/1783038802019-slang-11918-resolved-getrelativepath-returns-empty.md)
- [record-replay REPLAY path leaks: ReplayContext registries are raw/non-owning (DeepWiki wrong)](../learnings/1783073842766-slang-record-replay-the-replay-path-leaks-because-.md)
- [miniz heap-archive buffers are owned by per-archive callbacks, not global mz_free](../learnings/1783064260282-miniz-heap-archive-buffers-are-owned-by-per-archiv.md)
- [macOS: hidden visibility breaks cross-dylib typed catch of C++ exceptions (libc++abi RTTI-identity)](../learnings/1783011716114-macos-hidden-visibility-breaks-cross-dylib-typed-c.md)
- [Approach-A fix for descriptor-heap [noinline] texture params: reuse the hoistable heap global (PR #11502)](../learnings/1780769595819-approach-a-fix-for-descriptor-heap-noinline-textur.md)
- [slang#6557 loadModuleFromIRBlob-imports-module already fixed by RIFF rewrite (#7041)](../learnings/1783463091677-slang-6557-loadmodulefromirblob-imports-module-alr.md)
- [slang#9580 assoc-type-of-export-struct entry-point return crashes — stale post-link result layout (PR #8603 regression)](../learnings/1783557222885-slang-9580-assoc-type-of-export-struct-entry-point.md)
- [slang#8125 empty-struct fix — global field-removal pass is CI-rejected, fix belongs in empty-type legalization](../learnings/1783473465864-slang-8125-empty-struct-fix-global-field-removal-p.md)
- [slang#12040 IR type-legalization O(N^2) root cause is the per-round scratch reset + presence-gated re-queue](../learnings/1783674869932-slang-12040-ir-type-legalization-o-n-root-cause-is.md)
- [slang#12042 half double-rounding -- arithmetic benign, conversions are the hazard](../learnings/1783677064766-slang-12042-half-double-rounding-arithmetic-benign.md)
- [slang enum->int cast E99999: lowerEnumType gated only on EnumType, not cast ops](../learnings/1783700480198-slang-enum-int-cast-e99999-lowerenumtype-gated-onl.md)
- [Slang enum-cast lowering gate (calcRequiredLoweringPassSet) -- completeness reasoning (#12050)](../learnings/1783706489119-slang-enum-cast-lowering-gate-calcrequiredlowering.md)
- [slang#12051 DescriptorHandle reloads every use -- shouldDuplicateInstAtUseSite + non-hoistable cast op](../learnings/1783705209384-slang-12051-descriptorhandle-reloads-every-use-roo.md)
- [CORRECTION slang#12051: DescriptorHandle reuse ALREADY works on HLSL via a local; #11798 is input-syntax only](../learnings/1783724965975-correction-slang-12051-descriptorhandle-reuse-alre.md)
- [Slang entry-point layout fixes must be front-end (AST), not back-end IR rebuild](../learnings/1783710345558-slang-entry-point-layout-fixes-must-be-front-end-a.md)
_Catalog: [[wiki/index.md]]_
