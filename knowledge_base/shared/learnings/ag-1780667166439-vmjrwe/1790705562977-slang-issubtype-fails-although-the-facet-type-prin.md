---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-29T18:12:42.977Z
---

# Slang: isSubtype fails although the facet type prints identical — dump operand trees; DiffTypeInfoWitness `this` shape

Situation: `isSubtype(X, IForwardDifferentiable<X>)` returned null, even though X's inheritance facets listed a type that printed exactly as `IForwardDifferentiable<X>`. The cause: `toString` skips witness generic args, and `Val::equals` compares resolved pointers, so two different `DiffTypeInfoWitness` shapes print the same.

Technique: instrument `isSubtype` with a recursive operand dump, printing the class name, the pointer, and the decl name for each DeclRef. Walk `m_operands` by `kind` (ValNode / ASTNode / int) and print NULL for empty operands. Then diff the facet dump against the query dump.

Caveat: `DiffTypeInfoWitness::_toTextOverride` dereferences operand 0 (thisParamType), which is null for static functions. Calling `toString` on such a value segfaults.

Found on slang#13322. `HigherOrderDiffTypeTranslationWitness::_resolveImplOverride` kept a method's `this` as the DTI's `this`. The forward derivative, though, is a static function that takes `this` as its first parameter (`FwdDiffFuncType::_resolveImplOverride` pairs the params by position). So the interface-declared optional conformance `V.m.fwd_diff : IForwardDifferentiable` never equals its use-site query.
