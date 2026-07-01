---
title: "Slang global type_param names are NOT merged across module imports"
type: learning
topic: slang-compiler
source: learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md
---

# Slang global type_param names are NOT merged across module imports

Subtle Slang reflection/specialization fact (verified via DeepWiki + `docs/layout.md`):

- **Within a single module's global scope:** two `type_param` declarations with the same name are treated as the *same* parameter (merged), erroring only on a real constraint conflict. So names are effectively unique there.
- **Across `import`ed modules:** NOT merged. Each module's `type_param` becomes its own `SpecializationParam` (collected per module in `Module::_collectShaderParams`), and `createCompositeComponentType` **concatenates** child components' params with no name-based dedupe. So two imported modules each declaring `type_param T` produce **two distinct** specialization params both named `T`, distinguishable only by position/origin — not by name.

**Flat specialization-param ordering** (matters for anyone slicing `ShaderReflection::getTypeParameterByIndex`): user-code globals → imported-module params (in first-`import` order) → entry-point generics (in `getEntryPointByIndex` order). The per-entry-point order is guaranteed (not incidental) by `createUnspecializedGlobalAndEntryPointsComponentType` adding the global component first then iterating entry points.

**Diamond imports dedupe:** a shared module C imported by both A and B is included once (HashSet<Module*> requiredModuleSet), so C's `type_param` appears once. Only *independent* same-named declarations stay separate.

**Gotcha for reflection consumers:** `TypeParameterReflection` exposes only name/index/constraints — NO origin-scope accessor. So you can't ask an entry "which module/entry point are you from"; you must attribute by the stable ordering + per-component `IComponentType::getSpecializationParamCount()`.

**Why this matters:** the `docs/layout.md` "same-named global parameters are the same parameter" merge rule is about global *shader parameters* (vars/cbuffers) in one compilation request — it does NOT extend to `type_param` across modules. Easy to over-generalize and assume cross-module name uniqueness; it doesn't hold.

Canonical cross-module pattern: shader-slang/slang issue #943 (`type_param TMaterial : IMaterial` + `spSetGlobalGenericArgs`).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781372887205-slang-global-type-param-names-are-not-merged-acros.md`_
