---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788392858494-hjy0yl
written_at: 2026-09-02T23:58:26.410Z
---

# Slang static property feasibility — the work is 3 frontend edits, backend is free

Triaging shader-slang/slang#12893 (maintainer feature request: allow `static property` on types/interfaces), confirmed the whole static-vs-instance machinery keys off `HLSLStaticModifier`, and properties desugar to per-accessor ordinary functions — so a `static property` is architecturally just "accessors lowered as `this`-less functions." Verified @ local checkout:

- **`static property` already PARSES** (parsePropertyDecl slang-parser.cpp:4855; modifiers attached generically). No parse-time rejection.
- **Sole hard blocker is one line:** `isModifierAllowedOnDecl` HLSLStaticModifier case at `slang-check-modifier.cpp:1799` returns `as<VarDeclBase>(decl) || as<CallableDecl>(decl)`. A `PropertyDecl` is a `ContainerDecl` (slang-ast-decl.h:698), NOT a CallableDecl (cf. learning #12210) → rejected with `Diagnostics::ModifierNotAllowed`. Add `as<PropertyDecl>(decl)` to lift it.
- **`this`-elision gap:** `isEffectivelyStatic(decl,parent)` (slang-check-decl.cpp:1481-1494) reads the *accessor's own* HLSLStaticModifier + parent-kind cases; it has NO PropertyDecl case. Since `static` sits on the property (container), a static getter would still take `this`. Fix = propagate the modifier onto the child accessors during checking (clean; makes every downstream reader treat them like a static method), or teach isEffectivelyStatic to consult the parent property.
- **Requirement matching gap:** `doesPropertyMatchRequirement` (slang-check-decl.cpp:5520) does NOT compare static-ness, whereas method matching does (`:5373-5378`). A static-property requirement needs that compare added.
- **Backend near-free (VERIFIED):** PropertyDecl lowers to nothing; accessors lower as ordinary funcs (visitPropertyDecl slang-lower-to-ir.cpp:11567-11593); this-omission decided in the property frame (collectParameterLists :4377/:4384/:4435-4466); witness tables emit one entry per accessor keyed by getInterfaceRequirementKey :12565-12578; `addStaticRequirementDecoration` :12539 reads the accessor's own modifier (StaticRequirementDecoration slang-ir-insts.h:5324 has NO reader — metadata-only). No IR pass special-cases properties.

Reusable pattern: for any "allow modifier X on decl-kind Y" feature, first check `isModifierAllowedOnDecl` (slang-check-modifier.cpp) for the allow-list, then trace whether X's *semantics* (here: this-elision + requirement matching) are decided per the right decl. Also: associated constants can't substitute for this because `static const` requirements are restricted to int/bool via isValidCompileTimeConstantType (slang-check-decl.cpp:12077).
