---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790989204437-h0mkrb
written_at: 2026-10-03T02:07:01.985Z
---

# extern static const link-time folding only works for bare-literal int/bool initializers (enum and non-literal get no map entry)

Layout and reflection resolve `extern`/`export static const` values through `ComponentType::tryFoldIntVal` (slang-linkable.cpp:1259). That function looks names up in a map built by `collectExportedConstantInContainer` (:1196), which reads `varDecl->val` and silently skips declarations where it is null (:1203).

`val` is set in two places, and both miss common shapes:
- **Header fold** (slang-check-decl.cpp:2782): runs before the initializer has been checked, and only for `BasicExpressionType`. Only a bare literal folds here.
- **Body fallback** `_validateCircularVarDefinition` (:3476 / :2273): returns null for enums. For an extern int or bool it returns a `DeclRefIntVal` that points back at the declaration itself.

Consequences, verified on master 6ba151dcf (#13419):
- `extern static const Mode m = Mode.On;`, `extern static const int x = 1 + 0;`, `= ONE;`, `= int(1u);`, and `extern static const bool b = T;` all leave a `Conditional<Resource, cond>` with an empty layout. It gets no binding on any target, and reflection reports an empty struct.
- Link-time array sizes come out as "unknown".
- The IR side still resolves the value correctly (Off → E41027), so codegen looks fine while bindings disappear.

Confirmed with an instrumented build: the map entry is `name → name` for non-literal ints, and absent for enums.

What doesn't fix it: widening the :2782 gate to enums alone, because the initializer is unchecked at that point.

A prototype that works: LinkTime-fold the CHECKED initializer in `SemanticsDeclBodyVisitor::checkVarDeclCommon`, for const extern/export declarations with `isValidCompileTimeConstantType`. Watch for a side effect: E39999 gets reported twice on circular declarations.
