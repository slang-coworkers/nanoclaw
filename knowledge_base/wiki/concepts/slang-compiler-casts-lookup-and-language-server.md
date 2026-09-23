---
title: Slang Compiler Casts, Lookup & Language Server — Operator Resolution, Diagnostics Infra, and Module Versioning
type: concept
group: slang-grab-bag
tags: [slang, name-resolution, operators, lookup, optional, language-server, module-serialization, diagnostics]
source_count: 9
---

## TL;DR

Verified facts about Slang's front-end semantics, name resolution/lookup, the language server, and
module serialization — the kind of ground truth you must re-check against HEAD before asserting it,
because even maintainers get surprised.

- **A fallible `as` cast already yields `Optional<T>`, not a bare `T`** — so `if(let)`/`guard let`
  support `as`-operands for free (both are duck-typed on `.hasValue`/`.value`). The negative control
  (`B direct = obj as B;` failing E30019) is what proves the wrapper.
- **Slang infix operator resolution (`a OP b`) is pure lexical scope-chain lookup of the operator
  name — operand types play NO role.** No member-declared binary/unary operator is reachable; only
  free functions resolve. The only exceptions using member lookup are `operator()` and
  `__subscript`. This is documented + test-pinned as intentional. The maintainer-preferred fix for
  "an operator you declared is never honored" is a *declaration-site diagnostic* in
  `checkCallableDeclCommon`, not making member operators resolvable (a language-design change).
- **`Decl::hiddenFromLookup` only affects LOCAL vars** — it's `&&`-gated on `isLocalVar`, so setting
  it on a container member (struct/type/func) has no effect. Read the *honoring* site, not just the
  field definition, before trusting "set this flag."
- **A `[__AttributeUsage]` struct produces a synthesized mirror `AttributeDecl`**, so completion
  returns it twice (Struct(22) + Keyword(14)); dedup by final label in `collectAttributes`.
- **Slang has NO clang-style fix-it / structured code-replacement infrastructure** anywhere — every
  "fix-it" ask resolves to either a better diagnostic/note or a new cross-cutting project.
- **A serialized `.slang-module` has TWO version axes** — the container FORMAT version (checked on
  load) and the semantic module version `m_version` (NOT range-checked → the crash gap).

## `as`-casts, operators, and lookup

A fallible downcast `expr as T` is typed `Optional<T>`: `visitAsTypeExpr` sets the result via
`getOptionalType(targetType)` and lowering emits `MakeOptionalValue`/`MakeOptionalNone`. The
consequence for the `guard`/`guard let` feature (slang#12612) is that any construct consuming a
"condition" supports fallible `as` for free — no special-casing. The proof is the negative control:
`Optional<B> m = obj as B;` alone could be a coercion artifact, but `B direct = obj as B;` failing
E30019 proves the static type is `Optional<B>`. Even a language-design authority (@tangent-vector)
voiced surprise that `as` wasn't returning an Optional — treat a maintainer's surprise about existing
behavior as a contested claim and re-verify against HEAD with a compile ([fallible `as` cast already
yields Optional<T>](../learnings/1787675835939-slang-fallible-as-cast-already-yields-optional-t-v.md)).

Two atoms (from parallel sessions on issue #12761, both verified at master @ 8fe3df827) establish
that Slang infix operator resolution finds candidates by pure lexical scope-chain lookup of the
operator name — operand types play no role in *finding* candidates (no `lookUpMember`, no ADL). The
path is `visitInvokeExpr`→`CheckTerm`→`visitVarExpr`→`lookUp(...expr->scope...)`→`_lookUpInScopes`,
which walks `scope->parent` only. So NO member-declared binary/unary operator is reachable via
`a OP b` — plain struct member, non-generic extension, and both unconstrained and constrained generic
extensions all fail identically; only free file-scope functions resolve, and even a found member
operator couldn't match because implicit `this` isn't counted as a call argument. The two exceptions
that DO use member lookup are `operator()` and `__subscript`/`operator[]`. This is documented +
test-pinned as intentional. The maintainer-preferred fix (established by jkwak-work, who CLOSED the
"make the user's operator win" alternative PR #11879) is a declaration-site diagnostic in
`checkCallableDeclCommon` keyed off `getParentAggTypeDeclBase(decl) != nullptr &&
!isEffectivelyStatic(decl)` + an operator name — with two traps: `isPrefixOperatorName` matches only
`-+~!` (too narrow), and you MUST exclude `operator()`/`__subscript` (34 legitimate member
definitions depend on them; there are ZERO member-style binary/unary operator definitions in-tree, so
the exclusion regresses nothing). Making member operators actually resolvable is a language-design
change (precedence/commutativity/ambiguity) above a fixer's authority ([member operators unreachable
by infix lookup — declaration-site diagnostic is the maintainer-preferred
fix](../learnings/1787705815951-slang-member-operators-unreachable-by-infix-lookup.md),
[infix operator lookup ignores member/extension-declared operators (only free functions
resolve)](../learnings/1787706116993-slang-infix-operator-lookup-ignores-member-extensi.md)).

`Decl::hiddenFromLookup` is a narrower lever than its name suggests: it's consulted only inside
`_isUncheckedLocalVar`, which returns `isUnchecked && isLocalVar(decl)`, so setting it on a non-local
decl has NO effect — `_lookUpDirectAndTransparentMembers` still returns the member. To suppress a
redundant type decl you must widen the lookup filter (`DeclPassesLookupMask`), use a modifier the
mask already excludes, or exclude structurally. Only 3 sites set the flag today (all block-scope
locals). The lesson: read the *honoring* site before trusting "set this flag," and note redeclaration
checking runs at `ReadyForReference`, phase-ordered before any use-site body lookup ([hiddenFromLookup
only affects local vars (member lookup ignores
it)](../learnings/1787706486418-slang-hiddenfromlookup-only-affects-local-vars-mem.md)).

An associated type (or typealias) declared by an interface is reachable **through a value**, not
only through the type parameter. Given `interface IHasAssoc { associatedtype assocThing; }` and
`void f<T>(T t) where T : IHasAssoc`, the statement `t.assocThing local;` compiles — `t.assocThing`
is a valid type expression — because when a member is looked up on a value base but its decl is
*effectively static*, the lookup-result constructor (`slang-check-expr.cpp:535-551`, the `else if
(isEffectivelyStatic(...))` branch) rewrites the value access to a static, type-level reference built
from the value's static type and gives it a `TypeType`, so it is accepted where a type is expected
(`ExpectAType`). `isEffectivelyStatic` (`slang-check-decl.cpp:1512`) treats `AggTypeDecl` and
`SimpleTypeDecl` as static, and `AssocTypeDecl : public AggTypeDecl`, so associated types qualify
(`tests/language-feature/dynamic-dispatch/assoc-type-dynamic-dispatch.slang`). Review-calibration
(PR #13225): a reviewer suggested a constraint-suggestion diagnostic should reject
type-only/associated-type requirements on the *value-access* branch because "`v.m` can't reach
`associatedtype m`" — that premise is FALSE (the suggestion `where T : IHasAssoc` is correct advice),
and the fix author caught it with a compiler probe + a second codex review. Before recommending a
filter/guard that suppresses output on a "member kind X isn't reachable in context Y" assumption,
verify it against a built compiler — that is exactly the class of claim Slang's type system often
falsifies ([associated types are reachable through a value in type
position](../learnings/1790106628469-slang-associated-types-are-reachable-through-a-val.md)).

A companion provenance pitfall in the same constraint-suggestion work (#13140): to exclude
"builtin"/"library" decls, `isFromCoreModule(decl)` (`slang-lower-to-ir.cpp`) checks only
`FromCoreModuleModifier`, which is applied **solely** to the embedded core module (core.meta.slang /
hlsl / glsl, set in `slang-compile-request.cpp` when `m_isCoreModuleCode`). It does **not** cover the
separately-compiled standard-library modules under `source/standard-modules/` (`slang.numerics`,
`slang.functional`, `slang.neural`, `workgraph`, `differentiable`), which load from the
standard-module search path as ordinary imported `.slang` modules carrying **no**
`FromCoreModuleModifier`, so `isFromCoreModule` returns false and they leak into any "exclude builtin
decls" logic (surfacing only with `-experimental-feature`, since they are `[ExperimentalModule]`-gated).
There is **no** dedicated "is standard-library module" bit on `Module`/`ModuleDecl`, and
`[ExperimentalModule]` is a fragile proxy (means "experimental", not "standard library" — a user can
mark their own module experimental). The robust zero-infrastructure alternative is a same-module
identity check `getModuleDecl(someScope) == getModuleDecl(candidateDecl)` (precedent
`slang-check-expr.cpp:~1156`), which excludes core, ALL standard-library, and every other imported
module at once — but also excludes the user's own *imported* modules, narrowing "user-declared" to
"same-module" ([isFromCoreModule excludes only the embedded core module, not standard-library
modules](../learnings/1790111599486-isfromcoremodule-excludes-only-the-embedded-core-m.md)).

## Language server, diagnostics infra, and module versioning

Attribute-list completion returns a `[__AttributeUsage]` struct twice — once Struct(22), once
Keyword(14) — because `findOrSynthesizeAttributeDeclFromUserDefinedAttributeStruct` synthesizes a
mirror `AttributeDecl` (stripping the "Attribute" suffix), so the scope holds two decls for one
logical attribute; `lookUpAttributeDecl` widens the mask to accept both, and `collectAttributes`
emits both arms with no dedup. Recommended fix: dedup by final label with a deterministic kind
tie-break. Tests use `//TEST:LANG_SERVER(filecheck=CHECK):` + `//COMPLETE:line,col`, CPU-only and
committable ([user-defined attribute completion duplicates (struct + synthesized mirror
AttributeDecl)](../learnings/1787700311108-user-defined-attribute-completion-duplicates-struc.md)).

Slang has NO clang-style FixItHint / structured code-replacement infrastructure: core diagnostics
(FIDDLE-generated from `slang-diagnostics.lua`) support only textual notes, the language server has
no `textDocument/codeAction` handler (`TextEdit` exists only for formatting/completion), and
`MachineReadableDiagnostics` is a TSV logging format, not fix-its. So every "fix-it" ask resolves to
either (a) a better diagnostic/note — shippable now via a new `err`/`warning`/`note` — or (b) a
separate cross-cutting auto-edit project; don't promise auto-edits. (Adjacent facts: legacy HLSL
loop-variable scoping keys off the `.hlsl` file extension, not `-lang`; the language-version selector
is `-std`/`#language slang <year>`) ([Slang has no structured fix-it / auto-edit diagnostic
infrastructure](../learnings/1787705444892-slang-has-no-structured-fix-it-auto-edit-diagnosti.md)).

A serialized `.slang-module` carries TWO easily-conflated version axes. The container FORMAT version
(`IRModuleInfo::serializationVersion`, currently 1) governs payload encoding and IS checked on load
(`readSerializedModuleIR_` returns SLANG_FAIL on mismatch). The semantic module version
(`IRModule::m_version`, range 4..28) governs IR instruction-set *semantics* and is NOT range-checked
on load — this is the gap that crashes with 0xC0000005 when loading a too-new module. Op-level
incompatibility is only partially caught by the `kIROp_Unrecognized` stable-name mechanism, which
fires only when the newer module actually uses a new op; a pure version bump or a semantics change on
an existing op slips through. Any load-time gate belongs in `readSerializedModuleIR_` (choke-point
covering all three full-load callers); `m_version` is private and needs a public getter for a
caller-side check ([Slang serialized module has TWO version axes — only the format one is checked on
load](../learnings/1787695975002-slang-serialized-module-has-two-version-axes-only-.md)).

**Source learnings (9):**
- [Slang: fallible `as` cast already yields Optional<T>](../learnings/1787675835939-slang-fallible-as-cast-already-yields-optional-t-v.md) — if(let)/guard let support as-operands for free; negative control proves the wrapper.
- [User-defined attribute completion duplicates (struct + synthesized mirror AttributeDecl)](../learnings/1787700311108-user-defined-attribute-completion-duplicates-struc.md) — dedup by final label in collectAttributes with a deterministic kind tie-break.
- [Slang has no structured fix-it / auto-edit diagnostic infrastructure](../learnings/1787705444892-slang-has-no-structured-fix-it-auto-edit-diagnosti.md) — every fix-it ask is either a better diagnostic/note or a new cross-cutting project.
- [Slang member operators unreachable by infix lookup — declaration-site diagnostic is the fix](../learnings/1787705815951-slang-member-operators-unreachable-by-infix-lookup.md) — a OP b is pure scope lookup; exclude operator()/__subscript; broaden isPrefixOperatorName.
- [Slang infix operator lookup ignores member/extension-declared operators](../learnings/1787706116993-slang-infix-operator-lookup-ignores-member-extensi.md) — only free functions resolve; PR #11879 (make user's operator win) was closed unmerged.
- [Slang hiddenFromLookup only affects local vars (member lookup ignores it)](../learnings/1787706486418-slang-hiddenfromlookup-only-affects-local-vars-mem.md) — &&-gated on isLocalVar; read the honoring site, not just the field.
- [Slang serialized module has TWO version axes — only the format one is checked on load](../learnings/1787695975002-slang-serialized-module-has-two-version-axes-only-.md) — semantic m_version (4..28) is not range-checked; gate belongs in readSerializedModuleIR_.
- [associated types are reachable through a value in type position (t.assocThing)](../learnings/1790106628469-slang-associated-types-are-reachable-through-a-val.md) — the isEffectivelyStatic lookup branch rewrites value access to a TypeType; verify "member kind X unreachable in context Y" claims against a built compiler.
- [isFromCoreModule excludes only the embedded core module, not the source/standard-modules/ std-lib modules](../learnings/1790111599486-isfromcoremodule-excludes-only-the-embedded-core-m.md) — no std-lib provenance bit; same-module getModuleDecl identity check is the robust alternative but narrows to same-module.
