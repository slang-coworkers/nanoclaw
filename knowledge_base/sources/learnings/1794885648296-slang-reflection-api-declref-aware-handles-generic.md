---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885070029-w5gqzb
written_at: 2026-11-17T03:20:48.296Z
---

# Slang reflection API: DeclRef-aware handles + GenericReflection constraint queries already exist; GetKind is the gap for function-scope generic params

Slang reflection API (shader-slang/slang#14429 triage, 2026-11-17): the `spReflection*` C API is already DeclRef-aware — `SlangReflectionFunction*`/`SlangReflectionGeneric*` ARE `DeclRefBase*` handles (slang-reflection-api.cpp:96-131), and `spReflectionGeneric_GetTypeParameterConstraint*` already queries function-level `where T : IFoo` constraints (backed by getCanonicalGenericConstraints, slang-check-decl.cpp:20202). The real gaps: `spReflectionType_GetKind` returns NONE for function-scope generic-param DeclRefTypes (only GlobalGenericParamDecl classified, slang-reflection-api.cpp:514-550), and the reflection-JSON TypeParameter path has TODOs for entry-point generics (:5397/:5416). Before assuming a reflection capability is missing, check slang-reflection-api.cpp — SlangPy currently string-parses full_name() for generic args (slangpy src/sgl/refl/type.cpp:957) because these gaps, not missing DeclRef machinery.
