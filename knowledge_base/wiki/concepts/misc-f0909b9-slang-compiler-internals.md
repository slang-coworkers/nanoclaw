---
title: "Slang compiler internals: parser/checker, IR/serialization, emit, and diagnostics infrastructure"
type: concept
group: misc
tags: [slang, parser, checker, ir, serialization, emit, diagnostics, lowering, bindless, core-module, version-bump]
source_count: 15
---

## TL;DR

Grounded facts and fix patterns across the Slang compiler pipeline, from
triage/review sessions on real issues:

- **Parser/checker.** `static property` is ~3 frontend edits (backend near-free);
  `foo->Bar<T>()` E30101 is a non-idempotent member-expr double-check, not a parse
  bug; operator-named decls (`operator+`) are already referenceable as expressions
  except the `::`-qualified spelling. When synthesizing a closure/struct field,
  never borrow a type's name — `"This"` collides with reserved-name member lookup.
- **IR / legalization.** `-validate-ir-detailed` SIGABRT is the *post-pass module*
  validator (`E40007`), which `disableIRValidationScope()` cannot suppress —
  fix the producer's insert ordering. AnyValue bulk-copy empty-member eligibility
  must mirror empty-type-legalization preservation (ABI-significant decorations).
- **Serialization / versioning.** Two independent version constants:
  `kSupportedSerializationVersion` (container/AST format, enforced with `!=`) vs
  `IRModule::k_min/maxSupportedModuleVersion` (IR instruction-set, NOT numerically
  enforced). Inserting an AST node type is backward-incompatible (positional tags)
  and needs a `kSupportedSerializationVersion` bump; a new IR op is stable-named
  and safe.
- **Emit / bindless.** `DescriptorHandle<T>` lowers to `uint2` (two independent
  heap indices, not a 64-bit split); `.Handle` is a member type alias. CUDA `inout`
  subobject passes a field pointer directly with no copy temp; a copy-out workaround
  must get abort-safety from design, not a post-call write-back.
- **Diagnostics infra.** Severity is bound per-definition (can't downgrade a rich
  diagnostic to a note per-call — add a `standalone_note`); a loc-less diagnostic
  usually means a producer built an Expr without propagating `->loc`; diagnostics are
  now Lua-driven (`slang-diagnostics.lua`), pick a FREE code.
- **C++ review lens.** A `T{}` (value-init) test does NOT regress a new default
  member initializer — value-init zero-inits regardless.

## Parser / checker

**Static property is a small frontend feature.** `static property` already parses
(modifiers attach generically); the sole hard blocker is one line in
`isModifierAllowedOnDecl` (add `as<PropertyDecl>(decl)`), plus a this-elision gap
(`isEffectivelyStatic` has no PropertyDecl case) and a requirement-matching gap
(`doesPropertyMatchRequirement` doesn't compare static-ness). Backend is verified
near-free: PropertyDecl lowers to nothing and accessors lower as ordinary funcs. The
reusable pattern for any "allow modifier X on decl-kind Y" feature: check
`isModifierAllowedOnDecl` for the allow-list first, then trace whether X's semantics
are decided per the right decl
([static property feasibility — 3 frontend edits, backend is free](../learnings/1788393506410-slang-static-property-feasibility-the-work-is-3-fr.md)).

**`foo->Bar<T>()` E30101 is a double-check corruption.** `->` builds a
`DerefMemberExpr`; `visitMemberExpr` MUTATES the node in place (rewrites the pointer
base to its dereferenced form) and returns a *fresh* node, but `CheckTerm`'s
`checked` guard marks the returned node, never the input — so the member node stays
`checked==false` with its base already dereferenced. The generic branch wraps that
raw mutated node and re-checks it → a second `visitMemberExpr` on a now-non-pointer
base fires spurious E30101. The community fix wraps the already-checked base
(short-circuits the re-check) but sidesteps the latent hazard; true root-cause is to
make member-expr checking idempotent. Triage lesson: when a construct fails only in
ONE combination (arrow+generic) while neighbors pass, suspect a
re-entrancy/double-check interaction, not surface syntax
([foo->Bar<T>() 30101 is a non-idempotent member-expr double-check](../learnings/1788394233351-slang-foo-gt-bar-lt-t-gt-30101-is-a-non-idempotent.md)).

**Operator-named decls are ~90% already referenceable.** `ParseDeclName` is already
reused at both expression name-read sites, `operator` is a contextual keyword, and
operator decls carry the operator-symbol Name itself (`"+"`, not `"operator+"`), so
a synthesized VarExpr/MemberExpr resolves through ordinary lookup with no new
machinery. The one genuine gap is the `::`-qualified spelling
(`Type::operator+`), which reads names via `ParseStaticMemberName` and doesn't route
through `ParseDeclName`. General lesson: for "let X be spelled as an expression,"
check whether the expression-position name reader already shares the
declaration-position reader — the feature may fall out for free
([operator-named decls are already referenceable via ParseDeclName reuse](../learnings/1788910043597-operator-named-decls-are-already-referenceable-as-.md)).

**Never copy a type's name onto a synthesized field.** A lambda capturing `this`
inside an interface default method failed with E30019/E30011/E30022 because
`LambdaCaptureVisitor::maybeCaptureDecl` named the closure field after the capture's
source decl — for a `this`-capture that is the `This` `GenericTypeParamDecl`
*literally named "This"* — and member-wise `$init` re-resolves `this.This` by name,
where the reserved-name special case hijacks it to the closure struct type. Fix:
give a captured `this` a `$this` synthesized field name (local-var captures keep
their name). General lesson: member-wise `$init` synthesis re-resolves `this.<field>`
by name, so give synthesized receiver/capture slots a `$`-prefixed name
([synthesized closure/struct fields must not borrow a type's name](../learnings/1788793839980-synthesized-closure-struct-fields-must-not-borrow-.md)).

## IR, legalization, and validation

**`-validate-ir-detailed` SIGABRT is the post-pass module validator.** Slang has two
independent IR-validation mechanisms: at-insert (`validateIRInstOperands`, gated by
the thread-local `_enableIRValidationAtInsert`, just asserts) and post-pass module
(`validateIRModule(module, sink)`, emits the `E40007` diagnostic). The `E40007` code
is the tell — only the module path emits a code. `disableIRValidationScope()` flips
only the at-insert flag and has ZERO effect on an `E40007`; fix the producer's insert
ordering instead. Concrete case: a `DiffPair_*` struct inserted *before* a
block-local field-type operand (def-after-use in the same block) — emit-benign but
caught by detailed validation; anchor the struct after the later-defined type
([-validate-ir-detailed SIGABRT is the post-pass module validator](../learnings/1788584458760-slang-validate-ir-detailed-sigabrt-is-the-post-pas.md)).

**AnyValue bulk-copy empty-member eligibility must mirror legalization
preservation.** A zero-word-scalar-leaf member is only "free" (safe to skip in the
whole-object bulk-copy fast path) if empty-type legalization actually drops it.
Legalization *preserves* an empty type carrying an ABI/layout-significant decoration
(`Public`/`ExternCpp`/`DllImport`/`Layout`/`BinaryInterfaceType`/…) or a
target-intrinsic/work-graph-record type — a preserved empty gets a ≥1-byte footprint
and shifts subsequent fields, so a whole-object `bit_cast` moves the wrong bytes.
Thread an `enclosingPreserved` flag down (a preserved struct keeps its undecorated
empties), and extract the decoration set into a shared predicate consumed by both
`isSimpleType` and marshalling eligibility so the two can't drift
([AnyValue bulk-copy: empty-member eligibility must mirror empty-type-legalization preservation](../learnings/1788423298396-anyvalue-bulk-copy-empty-member-eligibility-must-m.md)).

## Serialization and version bumping (two distinct constants)

These two atoms clarify a common confusion — there are **two** version numbers:

1. **`IRModule::k_min/maxSupportedModuleVersion`** (slang-ir.h) is the IR
   instruction-set version and is **never numerically compared** against a loaded
   module. Deserialization rejects only on serialization *format* mismatch or an
   *unrecognized opcode* (via stable names). For an **emit-only** op created
   post-link (never serialized into a `.slang-module`), bumping has zero functional
   effect; precedent is ~50/50, enforcement is an advisory CI comment only. Bump
   anyway to silence the advisory, but it's conventional-not-required; never touch
   `k_minSupportedModuleVersion` unless removing an op
   ([k_maxSupportedModuleVersion: never numerically enforced; bump optional for emit-only ops](../learnings/1788427789186-slang-k-maxsupportedmoduleversion-never-numericall.md)).

2. **`IRModuleInfo::kSupportedSerializationVersion`** (slang-serialize-ir.cpp) stamps
   the container and IS enforced with `!=` (rejects older AND newer). Inserting a new
   **AST node type** mid-hierarchy is backward-incompatible because AST nodes
   serialize by their *positional* `ASTNodeType` tag (no stable-name indirection), so
   a new node shifts every later tag. Bump `kSupportedSerializationVersion` (NOT the
   IR-inst version). CRITICAL placement: both load paths call `readSerializedModuleAST`
   BEFORE `readSerializedModuleIR`, and AST decode is eager — so the pre-existing
   IR-side `!=` gate fires too late (AST already mis-decoded/crashed). Add an EARLY
   version gate reading only the version field before `readSerializedModuleAST`, on
   both paths
   ([serialized-module version bump: AST tags are positional and decode BEFORE IR](../learnings/1788677665628-slang-serialized-module-version-bump-ast-tags-are-.md)).

## Emit, bindless, and downstream shape

**`DescriptorHandle<T>` uint2 semantics.** `.Handle` is a member *type alias*
(`typealias Handle = DescriptorHandle<This>`), not a function, defined only on
`IOpaqueDescriptor` types. The `uint2` is TWO independent heap indices (common
misread: it is NOT a 64-bit low/high split) — for a plain resource `.x` = resource
heap index, `.y` = unused; for a combined texture-sampler `.x`/`.y` index the
resource/sampler heaps separately. `DescriptorHandle<T>` implicitly converts to `T`;
lowers to `uint2` at emit in `slang-emit-c-like.cpp:443-459`
([DescriptorHandle<T> uint2 semantics + .Handle typealias](../learnings/1788846740887-descriptorhandle-t-uint2-semantics-handle-typealia.md)).

**CUDA inout subobject.** `inout SG` lowers to `SG *`, and a field of an l-value
struct is passed DIRECTLY as `&(&path)->sg` with no copy temp; the dispatcher switch
forwards the pointer verbatim (standard valid C++/CUDA). When a "wrong-code" issue
root-causes to a downstream compiler (NVRTC/NVCC optimizer), the fixer deliverable is
a *characterization FileCheck test* pinning the valid emit shape, not a code fix.
Critical: a plain post-call write-back is NOT abort-safe (`undoParameterCopy` removes
such copies because an OptiX abort intrinsic can skip the copy-back) — a copy-out
workaround must get abort-safety from the DESIGN, and `SIMPLE -target cuda` verifies
emitted SOURCE shape only, not NVRTC acceptance
([CUDA inout-subobject verify: characterization test + abort-safety inversion](../learnings/1788638566109-cuda-inout-subobject-verify-characterization-test-.md)).

## Diagnostics infrastructure

**Severity is bound per-definition.** Rich (Lua-defined) diagnostics take severity
from the baked `getInfo()->severity`; the positional `diagnose(pos, DiagnosticInfo
copy, …)` overload routes through the non-rich formatter that doesn't understand
`~name:Type` placeholders, so per-call severity override does not work for rich
diagnostics. To show an error-severity reason as a *note*, add a `standalone_note(…)`
companion (an accepted pattern; `err(…)`=error, `note`/`standalone_note`=note). Also:
overload-candidate dedup identity must use full `DeclRef` (not `Decl*` or the
rendered signature, which collapse distinct specializations/constraints)
([diagnostic severity is per-definition; diag=CHECK is exhaustive substring matching](../learnings/1788902941686-slang-diagnostic-severity-is-per-definition-diag-c.md)).

**A loc-less diagnostic ⇒ a producer omitted `->loc`.** E30019 was emitted with NO
source location for a `ConstantBuffer<A>`/`<B>` mismatch (but not plain-struct or
StructuredBuffer) because `_coerce`'s ParameterGroupType branch synthesizes a
`DerefExpr` that sets base/type/checked but never `->loc`; the span loc comes from
`expr->loc`, so an invalid loc suppresses the whole caret block + the expected/got
label. Fix (1 line, producer-side): `derefExpr->loc = fromExpr->loc;`. General rule:
fix the producer that built the Expr without the loc, not the renderer
([E30019 loc-less: synthesized DerefExpr omits ->loc](../learnings/1788560155779-e30019-loc-less-synthesized-derefexpr-in-coerce-pa.md)).

**CLI once-per-invocation diagnostic hook.** To warn exactly once when `slangc`
produces a `.slang-module`/`.slang-lib` (and not on other targets or the core-module
bootstrap), hook `EndToEndCompileRequest::maybeCreateContainer()` (guarded on
`m_emitIr && m_containerFormat == SlangModule`); it already emits a locationless
diagnostic there. Do NOT hook the deeper `SerialContainerUtil::write(Module*)` — it
also fires on the host API and bootstrap, hitting the wrong audience. Diagnostics are
Lua-driven; pick a FREE code, not max+1
([Slang CLI: once-per-invocation hook to diagnose slang-module production](../learnings/1788897649053-slang-cli-once-per-invocation-hook-to-diagnose-sla.md)).

## Build and C++ review lenses

**Core-module stale cache: delete embed headers, not just touch.** After editing
`*.meta.slang`, the documented `cmake -E touch` + `generate_core_module_headers`
dance is NOT always sufficient — a build can reuse a STALE core-module cache and
report "261/261 pass" while masking a build-breaking `E30853`. To guarantee a clean
regen, `rm -f` the embed headers
(`build/source/slang-core-module/core-module-meta/{hlsl,core}.meta.slang.h`), the
generated blob, AND `slang-bootstrap`, then touch and rebuild; confirm the
`*.slang.h` mtime is newer than your edit. (A witness redefining a *defaulted*
interface requirement needs `override` or E30853 fires, surfaced only on a clean
regen)
([core-module stale-cache: delete embed headers, not just touch](../learnings/1788386919811-slang-core-module-stale-cache-delete-embed-headers.md)).

**Value-init vs default-init review lens.** When a C++ change adds a default member
initializer (`T* m_x{nullptr};`) to fix an uninitialized-member UB, check how the
regression test constructs the object: `Foo obj{};` is value-init and zero-inits a
defaulted ctor's members *regardless of* the new initializer, so it passes with or
without the fix — it does NOT regress the member-initializer change. `Foo obj;` is
default-init, the path the initializer actually fixes (but hard to test
deterministically since reading uninitialized memory is UB). Flag the mismatch as a
documentation nit
([value-init vs default-init: a T{} test does not regress a new default-member-initializer](../learnings/1788491306659-value-init-vs-default-init-a-t-test-does-not-regre.md)).

**Source learnings (15):**

- [Slang core-module stale-cache: delete embed headers, not just touch](../learnings/1788386919811-slang-core-module-stale-cache-delete-embed-headers.md) — a stale core-module cache reports "pass" while masking E30853; rm the embed headers + blob + slang-bootstrap before rebuilding.
- [Slang static property feasibility — the work is 3 frontend edits, backend is free](../learnings/1788393506410-slang-static-property-feasibility-the-work-is-3-fr.md) — `isModifierAllowedOnDecl` + this-elision + requirement-matching are the only gaps; check the allow-list first for any modifier-on-decl feature.
- [foo->Bar<T>() 30101 is a non-idempotent member-expr double-check (issue #9810)](../learnings/1788394233351-slang-foo-gt-bar-lt-t-gt-30101-is-a-non-idempotent.md) — visitMemberExpr mutates in place and CheckTerm's checked-guard misses it; fails-in-one-combination ⇒ suspect re-entrancy.
- [AnyValue bulk-copy: empty-member eligibility must mirror empty-type-legalization preservation](../learnings/1788423298396-anyvalue-bulk-copy-empty-member-eligibility-must-m.md) — a preserved (ABI-decorated) empty gets a nonzero footprint; thread enclosingPreserved and share one decoration predicate.
- [k_maxSupportedModuleVersion: never numerically enforced; bump is optional for emit-only ops](../learnings/1788427789186-slang-k-maxsupportedmoduleversion-never-numericall.md) — deserialization rejects on format-version or unknown-opcode only; bump to silence the advisory CI comment.
- [E30019 loc-less: synthesized DerefExpr in _coerce ParameterGroupType branch omits ->loc](../learnings/1788560155779-e30019-loc-less-synthesized-derefexpr-in-coerce-pa.md) — an invalid expr->loc suppresses the caret + expected/got; fix the producer with `derefExpr->loc = fromExpr->loc`.
- [Slang -validate-ir-detailed SIGABRT is the post-pass module validator, NOT the at-insert scope](../learnings/1788584458760-slang-validate-ir-detailed-sigabrt-is-the-post-pas.md) — the E40007 code is the tell; disableIRValidationScope can't fix it — fix the producer's insert ordering.
- [CUDA inout-subobject verify: characterization test + abort-safety inversion (slang#12916)](../learnings/1788638566109-cuda-inout-subobject-verify-characterization-test-.md) — pin the direct-pointer emit shape; a copy-out workaround must get abort-safety from design, not a post-call write-back.
- [Slang serialized-module version bump: AST tags are positional and decode BEFORE IR](../learnings/1788677665628-slang-serialized-module-version-bump-ast-tags-are-.md) — inserting an AST node needs a kSupportedSerializationVersion bump + an EARLY gate before readSerializedModuleAST on both load paths.
- [Synthesized closure/struct fields must not borrow a type's name (reserved-This collision)](../learnings/1788793839980-synthesized-closure-struct-fields-must-not-borrow-.md) — a field named "This" is hijacked by reserved-name member lookup in $init re-resolution; use a `$`-prefixed name.
- [DescriptorHandle<T> uint2 semantics + .Handle typealias (bindless)](../learnings/1788846740887-descriptorhandle-t-uint2-semantics-handle-typealia.md) — uint2 is two independent heap indices, not a 64-bit split; .Handle is a member type alias on IOpaqueDescriptor types.
- [Operator-named decls are already referenceable as expressions via ParseDeclName reuse](../learnings/1788910043597-operator-named-decls-are-already-referenceable-as-.md) — bare + member `.` forms already resolve; only the `::`-qualified spelling needs routing through ParseDeclName.
- [Slang CLI: once-per-invocation hook to diagnose slang-module production](../learnings/1788897649053-slang-cli-once-per-invocation-hook-to-diagnose-sla.md) — hook maybeCreateContainer (guarded on SlangModule), not the deeper SerialContainerUtil::write which hits the host API + bootstrap.
- [Slang diagnostic severity is per-definition; diag=CHECK is exhaustive substring matching](../learnings/1788902941686-slang-diagnostic-severity-is-per-definition-diag-c.md) — add a standalone_note companion to show an error reason as a note; dedup overload candidates by full DeclRef.
- [Value-init vs default-init: a T{} test does not regress a new default-member-initializer](../learnings/1788491306659-value-init-vs-default-init-a-t-test-does-not-regre.md) — `Foo obj{}` zero-inits regardless of the new initializer; only `Foo obj;` exercises the fixed path.
