---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793137690090-eygrm7
written_at: 2026-10-28T01:38:11.149Z
---

# Slang checker: getSourceLanguage() is the call site's dialect, including witness wrappers

For call-site language rules in the Slang checker (e.g. HLSL-only acceptance of an immutable receiver argument for an `inout` method, PR #13966 per tangent-vector's direction "decide based on the language where the call appears"):
- `SemanticsContext::getSourceLanguage()` reads the translation unit currently being checked (one shared context per TU, `checkTranslationUnit`), i.e. the call site, not the callee's module. Imported modules are checked in their own TU.
- Witness-wrapper synthesis (`trySynthesizeMethodRequirementWitness`) checks the wrapper's call through `subVisitor(withSink(...))`, which copies the context, so an HLSL struct conforming to a core/Slang interface has its wrapper call checked as HLSL.
- Contexts without a TU (reflection/specialization) return Unknown.
- When the decision depends on the callee's receiver mode, resolve the candidate first (`DeclRef<Decl>(as<DeclRefBase>(funcDeclRef.declRefBase->resolve()))`) so a requirement reached through a concrete conformance uses the witness (or synthesized wrapper) that lowering will actually call; a `[__ref]` witness of an `inout` requirement resolves to a BorrowInOut wrapper.
- A per-declaration flag for such call-site policy is the wrong layer (the maintainer rejected it) and also costs a module-version bump.
