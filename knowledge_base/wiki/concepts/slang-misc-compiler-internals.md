---
title: "Slang Compiler Internals: Parser, IR, Types, and Language Semantics"
type: concept
group: slang-grab-bag
tags: [parser, IRBuilder, type-interning, module-import, autodiff, SLANG_ASSERT, String, AST, DeclRefType, ThisType, source-location, lexer]
source_count: 23
---

# Slang Compiler Internals: Parser, IR, Types, and Language Semantics

This page covers internal compiler mechanics: parsing, IR builder source location stamping, type interning and dual-representation bugs, module import/re-export semantics, autodiff parameter conventions, platform macros, and runtime data structure gotchas.

## Lexer: Hex-Digit Decoder Bug

`getStringLiteralTokenValue` in `slang-lexer.cpp` has an inline hex-digit decoder that is missing `+10` for letter hex digits (a–f, A–F), causing string literals with hex escape letters to silently produce wrong byte values. Char literals use a separate correct utility ([[wiki/learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md]]).

## Parser: ParseDeclName Shared by Func and Var

`ParseDeclName` is shared between function and variable declarators, so `int operator+ = 10;` is silently accepted as a variable named `operator+`. Function-vs-variable disambiguation happens later at the commit point; the fix belongs at `CompleteVarDecl`, not the shared name reader ([[wiki/learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md]]).

The `parseTypeDef` function only handles the leading-array form, causing `typedef int arr[2];` (C/HLSL trailing-array form) to fail with an unexpected-integer-literal error. The principled fix is shared declarator machinery rather than patching the typedef-specific path ([[wiki/learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md]]).

## IRBuilder Source Location RAII

The `IRBuilderSourceLocRAII` wrapper in `lowerDecl` already stamps new instruction source locations from the builder stack when `createStructKey()` is called. An explicit `irFieldKey->sourceLoc = fieldDecl->loc` assignment directly after is likely redundant for in-source paths; verify empirically by deletion rather than assuming necessity ([[wiki/learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md]]).

## Type Interning: DeclRefType vs ThisType Dual-Representation

`ASTBuilder::getOrCreate<T>` keys on both the syntax class and operands, so `getOrCreate<ThisType>(base)` and `getOrCreate<DeclRefType>(base)` produce **distinct** `Type*` even for the same base. `DeclRefType::create` falls through to a plain `DeclRefType` for `MemberDeclRef` bases, causing the same interface `This` to exist as two distinct types ([[wiki/learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md]]).

A narrow 2-file fix for this dual-representation bug was superseded by a 44-file maintainer PR that canonicalized the underlying `associatedtype` constraint representation. When the same logical type interns differently based on access path, suspect a representation-canonicalization gap rather than patching the single divergence site ([[wiki/learnings/1781114755243-postmortem-shader-slang-slang-11465-superseded-by-.md]]).

## Module Import: Re-Export Semantics and Scope Chain

`using namespace N;` is lookup-local to the declaring module and is **never re-exported** through `import`; the primary-file leak that previously worked was a bug (now fixed via `pr: breaking`). Reconciled tests must add `using ns;` to the importer rather than deleting the test ([[wiki/learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md]]).

The `parentDecl == moduleDecl` conjunct in the module re-export filter is load-bearing via plain transitive `import` (not only `using namespace`). Imported module scopes are spliced onto the importing module's scope chain; weakening it to bare `as<FileDecl>` would cause unintended transitive import leakage ([[wiki/learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md]]).

Global `type_param` declarations are merged within a single module's global scope but are **not** merged across imported modules — each module's param becomes its own distinct `SpecializationParam` ([[wiki/learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md]]).

Precompiled `.slang-module` import triggers location-less diagnostics because IR-pass diagnostics lose file:line source location when the struct/field key is deserialized from a precompiled module. See also the regression verification note in [[wiki/concepts/slang-misc-pr-process-and-maintainer-workflow.md]].

## Autodiff: Backward Diff Out-Parameter Convention

In reverse-mode autodiff, a differentiable `out T y` parameter becomes a **bare `in T.Differential`** in the synthesized backward function, and `bwd_diff` writes back no primal values. Forward mode shapes `out` as `out DifferentialPair<T>` carrying both primal and tangent — forward-mode intuitions do not transfer to reverse mode ([[wiki/learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md]]).

## Scalar vs Vector Ternary Short-Circuit Semantics

A scalar-condition `?:` short-circuits by lowering to if-else control flow (design intent, target-independent), while a vector-condition `?:` does **not** short-circuit and is deprecated in favor of `select`. The language-reference doc was stale and needed correcting ([[wiki/learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md]]).

## SLANG_ASSERT and Release Build Behavior

`SLANG_ASSERT` compiles to `SLANG_ASSUME` (undefined-behavior license) in release builds — **not** a runtime check. Using it right before a pointer dereference is dangerous. Use `SLANG_RELEASE_ASSERT` to fail loudly in release builds. Narrowing an existing `SLANG_ASSERT` predicate can introduce release-only UB ([[wiki/learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md]]).

Using `SLANG_ASSERT=release-assert-only` when retesting an assert-failure ICE **suppresses the exact assertion** being tested, producing a false "fixed" result ([[wiki/learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md]]).

## Optimization Level Default

The default optimization level is `OptimizationLevel::Default` (1), not `None` (0), so `level != None` over-warns on every ordinary compile. The correct way to detect an explicitly-set `-O` flag is `CompilerOptionSet::hasOption(CompilerOptionName::Optimization)` ([[wiki/learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md]]).

## Platform Macros: Value-Style, Always Defined

Slang platform macros like `SLANG_OSX`, `SLANG_LINUX`, `SLANG_VC` are **always defined** (to 0 on inactive platforms) via `slang.h`, so `#ifdef SLANG_OSX` is unconditionally true. This applies in contexts where slang.h is included; prelude headers where slang.h is absent are the exception ([[wiki/learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md]]).

Converting `defined(SLANG_OSX)` to the value test `SLANG_OSX` silently drops iOS from the dlfcn branch since `SLANG_OSX` is 0 on iOS. The fix is to use the `SLANG_APPLE_FAMILY` aggregate, mirroring `SLANG_LINUX_FAMILY` on the Linux side ([[wiki/learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md]]).

## Slang::String Is Copy-On-Write

`Slang::String` is copy-on-write with a shallow copy constructor, making it unsafe to share across threads without a forced deep copy. The safe idiom is `String(x.getUnownedSlice())` under the producer's lock to get a uniquely-owned buffer ([[wiki/learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md]]).

## Initializer List Coercion: canCoerce Probe Divergence

A class of bug where brace initializers work in var-decl/return/assignment but fail as function arguments: a `return true` nested inside `if(outExpr)` in a coercion helper produces false-negatives during `canCoerce` probes (which call with `outExpr==nullptr`). The fix is to un-nest `return true` so viability is reported independently of output AST requests ([[wiki/learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md]]). PR #11818 fixed the success-return probe safety, but the error-return path in `createInvokeExprForExplicitCtor` still calls `diagnoseRaw` to the real sink during `canCoerce` probes, leaking hard diagnostics before overload ranking completes ([[wiki/learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md]]).

## #language Directive Precedence

A `#language slang <ver>` directive **unconditionally overrides** the session default (in either direction), while files without the directive keep the default. The code path is in the preprocessor; CLI `-std` and cross-module behavior have specific corollaries documented ([[wiki/learnings/1782153228750-slang-language-directive-precedence-unconditional-.md]]).

## Capability System: -capability vs [require]

The `-capability` command-line flag only affects target-compatibility checking (stage 2), not function self-consistency checking (stage 1). Public functions must declare `[require(...)]` explicitly; the flag cannot widen that declaration ([[wiki/learnings/1779907427493-slang-capability-does-not-silence-use-of-undeclare.md]]).

`[require]` attribute drops capabilities via a silent runtime-divergence (SS-class severity) — the missed-emit causes runtime-divergent behavior for capabilities that gate codegen decisions like path selection and SPIR-V versioning, while usage-driven caps are unaffected ([[wiki/learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md]]).

## MemoryScope Machinery Exists but Is Unwired

Slang already has `MemoryScope` enum, IR attribute, and coherent-buffer emit wiring, but all atomic operations hard-code `SpvScopeDevice`. Exposing atomic scope would be pure plumbing (add `IRMemoryScopeAttr` decoration to atomic insts) reusing existing representation ([[wiki/learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md]]).

## Lexer: escape validation belongs in the decode layer, not the scan pass

Escape-sequence *interpretation* in the Slang lexer is deferred and context-dependent: `getStringLiteralTokenValue` decodes escapes for real string values, but `getFileNameTokenValue` returns the **raw** quoted content and deliberately never processes escapes (`\` is a valid Windows path separator). Regression #11829 landed because PR #11714 added escape *validation* (`\u`/`\U` digit-count → E10007/E10008) into the token **scanning** pass, making it universal before a token's downstream role is known — so it fired on `#include "dir\utility\f.slangh"` paths. The principle: escape *validation* must ride the decode layer that interprets escapes, so consumers that opt out of interpretation (file-name paths) also opt out of validation ([[wiki/learnings/1782799753646-lexer-escape-validation-must-be-deferred-to-the-de.md]]).

## Synthesized member storage added after ctor-signature collection needs its own initExpr

When the front-end synthesizes a hidden storage member **after** the constructor signature is collected — e.g. the bitfield backing word `$bit_field_backing_N` created in `SemanticsDeclAttributesVisitor` — that member needs its own `initExpr`, otherwise it is left uninitialized in the synthesized ctor ([[wiki/learnings/1782847970010-synthesized-struct-storage-added-after-ctor-signat.md]]). Related: the `IDefaultInitializable` synthesis loop is off for bitfield structs, and a raw literal beats `DefaultConstruct` for backend-robust zero-init ([[wiki/learnings/1782847433081-slang-synthesized-member-init-idefaultinitializabl.md]]).

## Terminal count/sentinel enums: keep them IMPLICIT; static_asserts aren't uniqueness guards

When a trailing `CountOf`/`Count`/`NUM_*` sentinel enumerator collides with a real option (#11852: `CompilerOptionName::CountOf == SPIRVUnifiedDescriptorHeapStride == 154`), the durable fix is to restore **textual order == value order** and keep the sentinel *implicit* rather than pinning it explicitly ([[wiki/learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md]]). An implicit `CountOf` can silently alias an option when a concurrent-PR renumber breaks textual value-order — a subtle follow-on to the enum-collision hazard that survives the usual fix ([[wiki/learnings/1782853815255-implicit-countof-sentinel-aliases-an-option-when-a.md]]). And a `static_assert(CountOf == SomeNamedOption + 1)` guard is **not** a uniqueness guard: it only checks adjacency to one named enumerator, not the general "CountOf is unique" invariant ([[wiki/learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md]]).

## vk::binding parameter-binding predicates: single-kind guards are correct-but-fragile

A cluster of regressions from #11712 in `slang-parameter-binding`: the `vk::binding` entry-point diagnostic predicate keys off an AST type that must match the binder's layout-kind contract ([[wiki/learnings/1782864612564-vk-binding-entry-point-diagnostic-predicate-ast-ty.md]]); the same predicate misfires on a struct-of-resources entry param (#11861, a mirror of #11857) ([[wiki/learnings/1782871594193-slang-11861-vk-binding-on-struct-of-resources-entr.md]]). More generally, single-kind exclusion guards (e.g. `InputAttachmentIndex` falsely reserving descriptor set 0 because it lowers to `OpDecorateInputAttachmentIndex` and is not a descriptor set) are correct but fragile — reviewers reliably ask for a shared predicate covering all the non-descriptor-set kinds ([[wiki/learnings/1782879563848-single-kind-exclusion-guards-in-slang-parameter-bi.md]]).

## Record/replay stream is fixed-schema at the call level

In Slang's record/replay layer (`source/slang-record-replay/`), the recorded stream is **fixed-schema at the call level** even though each value carries a TypeId tag. On playback `executeNextCall` re-invokes the same call shape, so you must **never conditionally skip `RECORD_OUTPUT`** — a skipped output desynchronizes the stream for every subsequent call ([[wiki/learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md]]).

---
**Source learnings (34):**
- [[wiki/learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md]] — lexer hex-digit decoder bug
- [[wiki/learnings/1779907427493-slang-capability-does-not-silence-use-of-undeclare.md]] — capability flag vs [require]
- [[wiki/learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md]] — bwd_diff out-param convention
- [[wiki/learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md]] — scalar short-circuits, vector does not

- [[wiki/learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md]] — IRBuilder source-loc RAII may already stamp
- [[wiki/learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md]] — using namespace is lookup-local
- [[wiki/learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md]] — import re-export parentDecl==moduleDecl conjunct
- [[wiki/learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md]] — getOrCreate interns on syntax class
- [[wiki/learnings/1781114755243-postmortem-shader-slang-slang-11465-superseded-by-.md]] — postmortem: ThisType/DeclRefType superseded by canonicalization
- [[wiki/learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md]] — typedef trailing-array parse gap
- [[wiki/learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md]] — global type_param names not merged across imports
- [[wiki/learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md]] — [require]-drop is silent runtime-divergence
- [[wiki/learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md]] — SLANG_ASSERT release-assert-only false fixed
- [[wiki/learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md]] — SLANG_ASSERT is a no-op in release
- [[wiki/learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md]] — opt-level default is Default not None
- [[wiki/learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md]] — ParseDeclName shared by func and var
- [[wiki/learnings/1782153228750-slang-language-directive-precedence-unconditional-.md]] — #language directive precedence
- [[wiki/learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md]] — MemoryScope machinery exists but unwired
- [[wiki/learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md]] — platform macros are value-style
- [[wiki/learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md]] — presence→value macro conversions drop iOS
- [[wiki/learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md]] — Slang::String is COW
- [[wiki/learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md]] — init-list arg bugs canCoerce divergence
- [[wiki/learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md]] — init-list arg coercion #11730 fixed success but error path leaks
- [[wiki/learnings/1782799753646-lexer-escape-validation-must-be-deferred-to-the-de.md]] — Lexer escape-validation must be deferred to the decode layer, not the scan pass (#include opts out)
- [[wiki/learnings/1782847433081-slang-synthesized-member-init-idefaultinitializabl.md]] — Synthesized-member init: IDefaultInitializable loop off for bitfield structs; raw literal beats DefaultConstruct
- [[wiki/learnings/1782847970010-synthesized-struct-storage-added-after-ctor-signat.md]] — Synthesized struct storage added after ctor-signature collection needs its own initExpr
- [[wiki/learnings/1782853815255-implicit-countof-sentinel-aliases-an-option-when-a.md]] — Implicit CountOf sentinel aliases an option when a concurrent-PR renumber breaks textual value-order
- [[wiki/learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md]] — Sentinel static_assert pinned to a named option is not a uniqueness guard
- [[wiki/learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md]] — Terminal count/sentinel enums: prefer keeping them IMPLICIT, not explicit+static_assert
- [[wiki/learnings/1782864612564-vk-binding-entry-point-diagnostic-predicate-ast-ty.md]] — vk::binding entry-point diagnostic predicate (AST-type) must match binder's layout-kind contract
- [[wiki/learnings/1782871594193-slang-11861-vk-binding-on-struct-of-resources-entr.md]] — slang #11861: vk::binding on struct-of-resources entry param — mirror of #11857, same predicate
- [[wiki/learnings/1782879563848-single-kind-exclusion-guards-in-slang-parameter-bi.md]] — Single-kind exclusion guards in slang-parameter-binding are correct-but-fragile; reviewers ask for a shared predicate
- [[wiki/learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md]] — Record/replay stream is fixed-schema at the call level — never conditionally skip RECORD_OUTPUT
_Catalog: [[wiki/index.md]]_
