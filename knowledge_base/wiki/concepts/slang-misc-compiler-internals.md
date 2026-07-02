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

`getStringLiteralTokenValue` in `slang-lexer.cpp` has an inline hex-digit decoder that is missing `+10` for letter hex digits (a–f, A–F), causing string literals with hex escape letters to silently produce wrong byte values. Char literals use a separate correct utility ([slang-lexer.cpp has a duplicate hex-digit decoder with an off-by-ten bug](wiki/learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md)).

## Parser: ParseDeclName Shared by Func and Var

`ParseDeclName` is shared between function and variable declarators, so `int operator+ = 10;` is silently accepted as a variable named `operator+`. Function-vs-variable disambiguation happens later at the commit point; the fix belongs at `CompleteVarDecl`, not the shared name reader ([slang ParseDeclName shared by func and var declarators accepts operator names](wiki/learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md)).

The `parseTypeDef` function only handles the leading-array form, causing `typedef int arr[2];` (C/HLSL trailing-array form) to fail with an unexpected-integer-literal error. The principled fix is shared declarator machinery rather than patching the typedef-specific path ([Slang typedef trailing-array parse gap (parseTypeDef vs declarator machinery)](wiki/learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md)).

## IRBuilder Source Location RAII

The `IRBuilderSourceLocRAII` wrapper in `lowerDecl` already stamps new instruction source locations from the builder stack when `createStructKey()` is called. An explicit `irFieldKey->sourceLoc = fieldDecl->loc` assignment directly after is likely redundant for in-source paths; verify empirically by deletion rather than assuming necessity ([Slang: IRBuilder source-loc RAII may already stamp struct keys — explicit sourceLoc= can be redundant](wiki/learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md)).

## Type Interning: DeclRefType vs ThisType Dual-Representation

`ASTBuilder::getOrCreate<T>` keys on both the syntax class and operands, so `getOrCreate<ThisType>(base)` and `getOrCreate<DeclRefType>(base)` produce **distinct** `Type*` even for the same base. `DeclRefType::create` falls through to a plain `DeclRefType` for `MemberDeclRef` bases, causing the same interface `This` to exist as two distinct types ([Slang getOrCreate interns on syntax class — DeclRefType vs ThisType dual-representation bugs](wiki/learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md)).

A narrow 2-file fix for this dual-representation bug was superseded by a 44-file maintainer PR that canonicalized the underlying `associatedtype` constraint representation. When the same logical type interns differently based on access path, suspect a representation-canonicalization gap rather than patching the single divergence site ([postmortem: shader-slang/slang#11465 superseded by PR #11368](wiki/learnings/1781114755243-postmortem-shader-slang-slang-11465-superseded-by-.md)).

## Module Import: Re-Export Semantics and Scope Chain

`using namespace N;` is lookup-local to the declaring module and is **never re-exported** through `import`; the primary-file leak that previously worked was a bug (now fixed via `pr: breaking`). Reconciled tests must add `using ns;` to the importer rather than deleting the test ([slang #11443 verdict: using namespace is lookup-local, primary-file leak is a breaking bug-fix](wiki/learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md)).

The `parentDecl == moduleDecl` conjunct in the module re-export filter is load-bearing via plain transitive `import` (not only `using namespace`). Imported module scopes are spliced onto the importing module's scope chain; weakening it to bare `as<FileDecl>` would cause unintended transitive import leakage ([Slang import re-export: parentDecl==moduleDecl conjunct is load-bearing via transitive import, not using-namespace](wiki/learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md)).

Global `type_param` declarations are merged within a single module's global scope but are **not** merged across imported modules — each module's param becomes its own distinct `SpecializationParam` ([Slang global type_param names are NOT merged across module imports](wiki/learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md)).

Precompiled `.slang-module` import triggers location-less diagnostics because IR-pass diagnostics lose file:line source location when the struct/field key is deserialized from a precompiled module. See also the regression verification note in [[wiki/concepts/slang-misc-pr-process-and-maintainer-workflow.md]].

## Autodiff: Backward Diff Out-Parameter Convention

In reverse-mode autodiff, a differentiable `out T y` parameter becomes a **bare `in T.Differential`** in the synthesized backward function, and `bwd_diff` writes back no primal values. Forward mode shapes `out` as `out DifferentialPair<T>` carrying both primal and tangent — forward-mode intuitions do not transfer to reverse mode ([slang bwd_diff out-param convention — bare in-differential seed, no primal writeback](wiki/learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md)).

## Scalar vs Vector Ternary Short-Circuit Semantics

A scalar-condition `?:` short-circuits by lowering to if-else control flow (design intent, target-independent), while a vector-condition `?:` does **not** short-circuit and is deprecated in favor of `select`. The language-reference doc was stale and needed correcting ([Slang `?:` short-circuit semantics + #11403 disposition (scalar short-circuits by design; vector does not)](wiki/learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md)).

## SLANG_ASSERT and Release Build Behavior

`SLANG_ASSERT` compiles to `SLANG_ASSUME` (undefined-behavior license) in release builds — **not** a runtime check. Using it right before a pointer dereference is dangerous. Use `SLANG_RELEASE_ASSERT` to fail loudly in release builds. Narrowing an existing `SLANG_ASSERT` predicate can introduce release-only UB ([Slang: SLANG_ASSERT is a no-op (SLANG_ASSUME/UB-license) in release builds — use SLANG_RELEASE_ASSERT to actually fail loudly](wiki/learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md)).

Using `SLANG_ASSERT=release-assert-only` when retesting an assert-failure ICE **suppresses the exact assertion** being tested, producing a false "fixed" result ([SLANG_ASSERT=release-assert-only gives FALSE 'fixed' when triaging assert-failure ICEs](wiki/learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md)).

## Optimization Level Default

The default optimization level is `OptimizationLevel::Default` (1), not `None` (0), so `level != None` over-warns on every ordinary compile. The correct way to detect an explicitly-set `-O` flag is `CompilerOptionSet::hasOption(CompilerOptionName::Optimization)` ([Slang opt-level default is Default not None — use hasOption to detect explicit -O](wiki/learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md)).

## Platform Macros: Value-Style, Always Defined

Slang platform macros like `SLANG_OSX`, `SLANG_LINUX`, `SLANG_VC` are **always defined** (to 0 on inactive platforms) via `slang.h`, so `#ifdef SLANG_OSX` is unconditionally true. This applies in contexts where slang.h is included; prelude headers where slang.h is absent are the exception ([Slang platform macros are value-style (always defined) — defined()/#ifdef on them is an always-true bug](wiki/learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md)).

Converting `defined(SLANG_OSX)` to the value test `SLANG_OSX` silently drops iOS from the dlfcn branch since `SLANG_OSX` is 0 on iOS. The fix is to use the `SLANG_APPLE_FAMILY` aggregate, mirroring `SLANG_LINUX_FAMILY` on the Linux side ([Presence→value SLANG_* macro conversions can silently narrow the active-platform side (iOS dropped from dlfcn)](wiki/learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md)).

## Slang::String Is Copy-On-Write

`Slang::String` is copy-on-write with a shallow copy constructor, making it unsafe to share across threads without a forced deep copy. The safe idiom is `String(x.getUnownedSlice())` under the producer's lock to get a uniquely-owned buffer ([Slang::String is COW — deep-copy via String(x.getUnownedSlice()) to share across threads](wiki/learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md)).

## Initializer List Coercion: canCoerce Probe Divergence

A class of bug where brace initializers work in var-decl/return/assignment but fail as function arguments: a `return true` nested inside `if(outExpr)` in a coercion helper produces false-negatives during `canCoerce` probes (which call with `outExpr==nullptr`). The fix is to un-nest `return true` so viability is reported independently of output AST requests ([Slang init-list-as-argument bugs: check canCoerce viability-probe (outExpr==null) divergence](wiki/learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md)). PR #11818 fixed the success-return probe safety, but the error-return path in `createInvokeExprForExplicitCtor` still calls `diagnoseRaw` to the real sink during `canCoerce` probes, leaking hard diagnostics before overload ranking completes ([slang init-list arg coercion: #11730 fixed the success return's probe-safety but the ERROR return still leaks a real-sink diagnostic during canCoerce](wiki/learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md)).

## #language Directive Precedence

A `#language slang <ver>` directive **unconditionally overrides** the session default (in either direction), while files without the directive keep the default. The code path is in the preprocessor; CLI `-std` and cross-module behavior have specific corollaries documented ([Slang #language directive precedence: unconditional per-file override of the option-set default](wiki/learnings/1782153228750-slang-language-directive-precedence-unconditional-.md)).

## Capability System: -capability vs [require]

The `-capability` command-line flag only affects target-compatibility checking (stage 2), not function self-consistency checking (stage 1). Public functions must declare `[require(...)]` explicitly; the flag cannot widen that declaration ([Slang `-capability` does not silence 'use of undeclared capability' — it's a per-function contract](wiki/learnings/1779907427493-slang-capability-does-not-silence-use-of-undeclare.md)).

`[require]` attribute drops capabilities via a silent runtime-divergence (SS-class severity) — the missed-emit causes runtime-divergent behavior for capabilities that gate codegen decisions like path selection and SPIR-V versioning, while usage-driven caps are unaffected ([slang#11631 severity: [require]-drop is a SILENT runtime-divergence (SS-class), and only hits codegen-DECISION caps](wiki/learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md)).

## MemoryScope Machinery Exists but Is Unwired

Slang already has `MemoryScope` enum, IR attribute, and coherent-buffer emit wiring, but all atomic operations hard-code `SpvScopeDevice`. Exposing atomic scope would be pure plumbing (add `IRMemoryScopeAttr` decoration to atomic insts) reusing existing representation ([Slang MemoryScope machinery exists but is unwired to atomics (issue #6970)](wiki/learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md)).

---
**Source learnings (24):**
- [lexer hex-digit decoder bug](wiki/learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md)
- [capability flag vs [require]](wiki/learnings/1779907427493-slang-capability-does-not-silence-use-of-undeclare.md)
- [bwd_diff out-param convention](wiki/learnings/1780332708129-slang-bwd-diff-out-param-convention-bare-in-differ.md)
- [scalar short-circuits, vector does not](wiki/learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md)

- [IRBuilder source-loc RAII may already stamp](wiki/learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md)
- [using namespace is lookup-local](wiki/learnings/1780477032580-slang-11443-verdict-using-namespace-is-lookup-loca.md)
- [import re-export parentDecl==moduleDecl conjunct](wiki/learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md)
- [getOrCreate interns on syntax class](wiki/learnings/1780529958264-slang-getorcreate-interns-on-syntax-class-declreft.md)
- [postmortem: ThisType/DeclRefType superseded by canonicalization](wiki/learnings/1781114755243-postmortem-shader-slang-slang-11465-superseded-by-.md)
- [typedef trailing-array parse gap](wiki/learnings/1781218629168-slang-typedef-trailing-array-parse-gap-parsetypede.md)
- [global type_param names not merged across imports](wiki/learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md)
- [[require]-drop is silent runtime-divergence](wiki/learnings/1781686744418-slang-11631-severity-require-drop-is-a-silent-runt.md)
- [SLANG_ASSERT release-assert-only false fixed](wiki/learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md)
- [SLANG_ASSERT is a no-op in release](wiki/learnings/1781807946287-slang-slang-assert-is-a-no-op-slang-assume-ub-lice.md)
- [opt-level default is Default not None](wiki/learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md)
- [ParseDeclName shared by func and var](wiki/learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md)
- [#language directive precedence](wiki/learnings/1782153228750-slang-language-directive-precedence-unconditional-.md)
- [MemoryScope machinery exists but unwired](wiki/learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md)
- [platform macros are value-style](wiki/learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md)
- [presence→value macro conversions drop iOS](wiki/learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md)
- [Slang::String is COW](wiki/learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md)
- [init-list arg bugs canCoerce divergence](wiki/learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md)
- [init-list arg coercion #11730 fixed success but error path leaks](wiki/learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md)
_Catalog: [[wiki/index.md]]_
