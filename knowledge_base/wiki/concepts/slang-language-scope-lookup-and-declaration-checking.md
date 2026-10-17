---
title: "Slang Scope Lookup, Function-Local Types, and Declaration Checking"
type: concept
group: slang-language-core
tags: [slang, lookup, _lookUpInScopes, scope, function-local-type, local-struct, ParamDecl, isLocalVar, _isUncheckedLocalVar, extension, namespace, hiddenFromLookup, self-reference, EmptyDecl, GenericDecl, checkInterfaceConformance, checkTypeModifier, ModifiedTypeExpr, e30015, e31201, e38100, e99999]
source_count: 7
---

# Slang Scope Lookup, Function-Local Types, and Declaration Checking

How the Slang semantic checker resolves unqualified names by walking scopes in `_lookUpInScopes` (`slang-lookup.cpp`), and a few declaration-checking rules from the same October 2026 front-end cluster. The page covers function-local types and the enclosing function (#13435, PR #13718), extension bodies (#13721), a local whose initializer names itself (#2958), the interface `EmptyDecl` skip, and declaration modifiers in a type position. Related: parser-time lookup and the `namespace A::B` reopen on [Slang Parser: tryParseGenericApp Classification and Parser-Time Lookup](../concepts/slang-language-parser-generic-app-and-lookup.md); the interface requirement loop on [Slang conformance checking: requirement enumeration and method-requirement witness synthesis](../concepts/slang-language-core-requirement-witness-synthesis.md); the first `checkTypeModifier` triage on [Slang Compiler Frontend and Semantic Checking](../concepts/slang-compiler-frontend-and-checking.md).

## TL;DR

- A member of a struct declared in a function body must not resolve names to the enclosing function's parameters or non-static locals. Slang has no capture for local types. The maintainer ruling on #13435 is to diagnose the use (E30015 is acceptable). Lambdas own capture.
- The boundary belongs in `_lookUpInScopes`, the producer. After the walk crosses an `AggTypeDeclBase` scope, `ScopeDecl` and `CallableDecl` scopes drop `ParamDecl` and non-static `isLocalVar` results.
- Filter the Member breadcrumbs as well as the found decl. A function-local `cbuffer CB { int c; }` is a transparent local, so `c` is found as the field and `CB` appears only in the breadcrumb.
- When dropping a name leaves a scope's result empty, stop the walk. Continuing to the next scope silently binds a shadowed global. C++ rejects that case, and `::x` still reaches the global.
- A post-lookup check that compares parent functions misses a local `static const` initializer, because `getParentFunc` walks through the `AggTypeDecl` to the enclosing function.
- `_isUncheckedLocalVar` filters by declaration order only, and `isLocalVar` does not cover `ParamDecl`.
- In C++, a local-class member that names a variable which is both an enclosing local and a global is rejected; lookup does not fall back to the global. Check any "C++ semantics" claim with `g++ -fsyntax-only` before writing it into a brief.
- An extension body sees its own scope, its lexical parents, and the target type's members. It does not see the target's enclosing namespace or struct, so `extension N::T { return nsValue; }` gives E30015.
- Workarounds for extension bodies: qualify the name (`N::x`), add `using namespace N;`, or write the extension lexically inside `namespace N {}`.
- With a global `v` and `N::v`, `extension N::T { return v; }` binds the global today. A fix to extension lookup changes that binding, so it must choose an order and test it.
- `let a = 1; { let a = a + 1; }` uses the outer `a`. This is the deliberate #2958 rule, pinned by the core module and by tests. Changing it is source-breaking and is a language-design / version-gating decision (umbrella #13719), not a quick bug fix.
- A diagnostic for a self-referencing initializer must be reported before `getTypeForDeclRef`, which asserts `!_isUncheckedLocalVar`.
- The interface requirement loop must skip `EmptyDecl` through `maybeGetInner`: `as<EmptyDecl>(maybeGetInner(member))`. `__generic<U> ;` parses as `GenericDecl { inner = EmptyDecl }`. Put the skip before `ensureDecl` so attribute validation still runs.
- In `checkTypeModifier`, any modifier that is not a `TypeModifier` reports E31201 `ModifierNotAllowed`, the same code as in declaration position. E99999 stays only for an unhandled `TypeModifier` subclass.
- `func f(x: inout int)` then reports E31201 + E30011 instead of E99999. Supporting that documented spelling needs a parser change.
- A codex CODE_REVIEW or OUTPUT_REVIEW reply can be a wiki-recall blurb instead of a review. Re-ask on the same `threadId` for the structured output before trusting the verdict.

## Function-local types must not see enclosing parameters or locals (#13435, PR #13718)

Consider this example:

```slang
int f(int x)
{
    struct S
    {
        int get() { return x; }   // must not bind the parameter x of f
    }
    S s;
    return s.get();
}
```

Before PR #13718, the member `get` resolved `x` to the parameter of `f`. `_lookUpInScopes` walks `Scope->parent` from the method body, through the block `ScopeDecl`, and into the `FuncDecl` with no boundary. The only filter for locals, `_isUncheckedLocalVar`, deals with declaration order, and `isLocalVar` does not cover `ParamDecl`. The same leak happens in method bodies and in field or `static const` initializers. Lowering then refers to a value that does not exist in the member's own function. The result is a silent miscompile: HLSL references an undeclared `x_0` or `_S1`, SPIR-V fails validation with "does not dominate", and a Debug build ICEs in `typeflow-specialize.cpp:86`. The maintainer ruling (skiminki-nv, #13435, 2026-10-16) is that Slang does not capture for local types, so the use is diagnosed (E30015 is acceptable); capture belongs to lambdas [function-local types see enclosing locals/params through an unbounded scope walk](../learnings/1792157985562-slang-function-local-types-see-enclosing-locals-pa.md).

The fix sits in lookup, the producer of the binding. `_lookUpInScopes` sets a flag after it passes an `AggTypeDeclBase` scope. That is the same point where `_doesScopeBlockUseOfEnclosingThisExpr` flips the `this` breadcrumb. Later `ScopeDecl` and `CallableDecl` scopes then drop `ParamDecl` results and non-static `isLocalVar` results [the lookup boundary in `_lookUpInScopes`](../learnings/1792176216247-slang-function-local-types-must-not-see-enclosing-.md). A check after lookup that compares parent functions does not work. For a local `static const` initializer, `m_parentFunc` is the enclosing function, because `getParentFunc` walks through the `AggTypeDecl`, so the comparison does not see the boundary [same](../learnings/1792157985562-slang-function-local-types-see-enclosing-locals-pa.md).

Two details are not obvious [same fix](../learnings/1792176216247-slang-function-local-types-must-not-see-enclosing-.md):

1. A function-local `cbuffer CB { int c; }` is a transparent local. Lookup finds `c` as the field, and `CB` appears only in the item's Member breadcrumb. The filter must check the breadcrumbs too, or `c` leaks through.
2. If dropping the name leaves the scope's result empty, the walk must `break`. Otherwise it continues outward and silently binds a global with the same name. g++ and clang reject that case, and `::x` still reaches the global.

Lambdas written directly in the function are not affected. The scope chain of a lambda body never crosses a type decl, because the synthesized `LambdaDecl` is not on that chain.

The shadowed case matches C++. A triage memo for #13435 first claimed the opposite. In C++, if a member of a function-local class names `x`, the enclosing function has a local `int x`, and a global `int x` also exists, lookup still finds the local and the use is rejected. g++ reports "use of local variable with automatic storage from containing function"; clang reports "reference to local variable 'x' declared in enclosing function". `::x` reaches the global. An error in the shadowed case is therefore the C++-consistent result, and silently binding the global would be the divergence. Check a claim about C++ semantics with `g++ -fsyntax-only` before writing it into a brief [C++ local class: a shadowed global is not reachable by unqualified name](../learnings/1792163585759-c-local-class-shadowed-global-is-not-reachable-by-.md).

## Extension bodies use lexical-only lookup (#13721)

Consider this example:

```slang
namespace N
{
    static const int nsValue = 1;
    struct T {}
}

extension N::T
{
    int get() { return nsValue; }   // E30015
}
```

Unqualified lookup in an extension body searches the extension's own scope, its lexical parents, and the members of the target type. The `ExtensionDecl` branch of `_lookUpInScopes` (`slang-lookup.cpp:895-915`) does a member lookup on `getTargetType`. It never searches the target decl's enclosing namespace or struct. So `nsValue` is not found, and `extension Outer::Inner { return outerStatic; }` also fails, even though a method in `Inner`'s own body sees `Outer`'s statics. Three spellings compile: a qualified name (`N::nsValue`), `using namespace N;`, or an extension written lexically inside `namespace N {}` [extension bodies use lexical-only lookup](../learnings/1792178854023-slang-extension-bodies-use-lexical-only-lookup-ext.md).

A fix has a shadowing trap. With a global `v` and `N::v`, `extension N::T { return v; }` binds the global today. A C++-style fix would change that binding silently, so a fix must choose an ordering and test it. Nothing settles the question yet. The spec has no rule (`lookup.md` is a placeholder). The #11577 namespace pre-pass comment (`slang-check-decl.cpp:5592-5623`) covers only how the *header* of a file-scope `extension N::T` resolves, not the body. No test under `tests/` uses a namespace-qualified extension target. Slang does not parse an out-of-line `void N::T::f() {}`, so there is no existing mechanism to reuse [same](../learnings/1792178854023-slang-extension-bodies-use-lexical-only-lookup-ext.md).

## A local's initializer that names itself binds the outer name (#2958)

Consider this example:

```slang
let a = 1;
{
    let a = a + 1;   // uses the outer a
}
```

The inner initializer silently uses the outer `a`, and a plain `let a = a;` gives E30015. This is deliberate. `visitBlockStmt` sets `hiddenFromLookup` on block locals (`slang-check-stmt.cpp:129-146`) and clears it only after `ensureDecl(DefinitionChecked)` (`:86-87`). `_isUncheckedLocalVar` (`slang-lookup.cpp:174`) skips the hidden local, so lookup walks outward. An untyped `let` also excludes itself through `withDeclToExcludeFromLookup` (`slang-check-decl.cpp:2673`) [local self-reference binds the outer name by design](../learnings/1792178859050-slang-local-self-reference-in-initializer-binds-to.md).

Commit cdfea42f1 (#2958, fixing #2936) introduced the rule; it replaced the older "used before its declaration" error. Code that depends on it:

- the core module, `hlsl.meta.slang:9102` (`let value = bit_cast<uint64_t>(value);`)
- `tests/bugs/gh-2936.slang:42`
- `tests/diagnostics/local-used-in-own-declaration.slang` and `multi-declarator.slang`, which expect E30015
- `docs/generated/tests/design/name-resolution/scopes/block-decl-init-resolves-outer-same-name.slang`

DXC follows the C++ rule instead: `int max = max(a, b)` gives "called object type 'int' is not a function". A fix that adopts the C++ rule must report its error before `getTypeForDeclRef`, which asserts `!_isUncheckedLocalVar` (`slang-check-decl.cpp:1677`). Changing the rule is source-breaking, so treat it as a language-design or version-gating decision (#13720, #13674, umbrella #13719) [same](../learnings/1792178859050-slang-local-self-reference-in-initializer-binds-to.md).

## Interface members: the `EmptyDecl` skip must unwrap `GenericDecl`

The ordinary-member requirement loop in `SemanticsVisitor::checkInterfaceConformance` (`slang-check-decl.cpp`) is a deny-list. A plain `if (as<EmptyDecl>(member)) continue;` fixes `property T X { get; };` and `interface I { ; }`. It misses `__generic<U> ;` inside an interface, which parses as `GenericDecl { inner = EmptyDecl }` and still gives E38100 "does not provide required interface member ''" with the note "see declaration of 'generic'". The skip is `as<EmptyDecl>(maybeGetInner(member))`. That matches IR lowering's `shouldDeclBeTreatedAsInterfaceRequirement`, which unwraps generics and returns false for `EmptyDecl`. Placing the skip before `ensureDecl` keeps attribute validation: `[ForceInline];` still gives E31002, because `ensureAllDeclsRec` checks the `EmptyDecl`. `/code-review medium` found the generic case during eval trial slang-13337#r1 [the EmptyDecl skip must unwrap GenericDecl](../learnings/1792178638025-interface-emptydecl-skip-must-unwrap-genericdecl-g.md).

## Declaration modifiers in a type position: E31201, not E99999

All of these reach `SemanticsExprVisitor::checkTypeModifier` (`slang-check-expr.cpp` ~:9594): `property override float3 X`, `typealias A = public float`, `-> inline float`, `(override float)x`, `Box<extern float>`, `let x : static float`, and HLSL `typedef precise int`. The path is `_parseTypeSpec(parser)` → `_applyModifiersToTypeSpec`, which by design puts *all* leading modifiers on a `ModifiedTypeExpr` and leaves the diagnosis to the checker. The fix belongs at that checker layer: `else if (!as<TypeModifier>(modifier))` reports `Diagnostics::ModifierNotAllowed{.modifier}` (E31201), the same code as in declaration position. E99999 remains only for a `TypeModifier` subclass the checker does not handle; today that is only `GLSLBufferModifier`, which nothing produces. One side effect: the documented `func f(x: inout int)` changes from E99999 to E31201 + E30011. Supporting that spelling needs a parser change that keeps direction modifiers on the `ParamDecl` [checkTypeModifier: E99999 → E31201](../learnings/1792176331466-declaration-modifiers-in-type-position-checktypemo.md).

## Tooling notes from this cluster

- A codex CODE_REVIEW or OUTPUT_REVIEW call sometimes returns a wiki-recall blurb instead of a review, and the critique tracker still records it. Re-ask on the same `threadId` for the structured output before trusting the verdict [#13718 note](../learnings/1792176216247-slang-function-local-types-must-not-see-enclosing-.md).
- In a fresh worktree, `git submodule update` needs `-c protocol.file.allow=always`, because the base clone's submodules are local paths. clang-format 17 is at `/workspace/agent/.fmt-venv/bin` [checkTypeModifier session notes](../learnings/1792176331466-declaration-modifiers-in-type-position-checktypemo.md).
- The critique deliver-gate fires on any command text that matches `repos/<x>/pulls`, even a read-only GET. List PRs with `gh pr list --repo …` before OUTPUT_REVIEW [same](../learnings/1792176331466-declaration-modifiers-in-type-position-checktypemo.md).

## Contradictions / supersessions

- The first #13435 atom describes the leak as current behaviour. PR #13718 fixed it, and the current rule is the lookup boundary in `_lookUpInScopes`. The first atom stays live because it alone records the maintainer ruling and the `m_parentFunc` trap.
- A #13435 triage memo claimed that C++ falls back to the global in the shadowed case. It does not; g++ and clang reject the use.
- The conformance page records a one-line `if (as<EmptyDecl>(member)) continue;` as the #13337 fix. That form misses `__generic<U> ;`; the complete skip uses `maybeGetInner`.
- The earlier `checkTypeModifier` triage on the frontend page names E31201 as the natural replacement. The newer atom confirms that shape and adds the `TypeModifier` condition and the `inout` side effect.

**Source learnings (7):**
- [members of a function-local struct resolve enclosing params/locals through an unbounded `_lookUpInScopes` walk; maintainer ruling: no capture, diagnose; `m_parentFunc` trap (#13435)](../learnings/1792157985562-slang-function-local-types-see-enclosing-locals-pa.md)
- [lookup boundary after `AggTypeDeclBase` drops ParamDecl and non-static locals; filter breadcrumbs (cbuffer); break on empty result (PR #13718)](../learnings/1792176216247-slang-function-local-types-must-not-see-enclosing-.md)
- [C++ local class: a shadowed global is not reachable by unqualified name; g++/clang reject, `::x` escapes](../learnings/1792163585759-c-local-class-shadowed-global-is-not-reachable-by-.md)
- [extension bodies use lexical-only lookup, so `extension N::T` cannot see N's names; shadowing trap; no spec rule (#13721)](../learnings/1792178854023-slang-extension-bodies-use-lexical-only-lookup-ext.md)
- [a local's self-referencing initializer binds the outer name by design (#2958); pinned code; changing it is source-breaking (#13719)](../learnings/1792178859050-slang-local-self-reference-in-initializer-binds-to.md)
- [the interface `EmptyDecl` requirement skip must unwrap `GenericDecl` (`__generic<U> ;`), placed before `ensureDecl`](../learnings/1792178638025-interface-emptydecl-skip-must-unwrap-genericdecl-g.md)
- [declaration modifiers in a type position: `checkTypeModifier` reports E31201 for non-`TypeModifier`s; `inout` param side effect](../learnings/1792176331466-declaration-modifiers-in-type-position-checktypemo.md)
