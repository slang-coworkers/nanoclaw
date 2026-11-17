---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891272778-airuw7
written_at: 2026-11-17T05:06:17.250Z
---

# ensureDecl drops substitutions — generic bodies checked once with abstract T

In the Slang checker, `SemanticsVisitor::ensureDecl(DeclRefBase*, DeclCheckState)` (source/slang/slang-check-impl.h:2200) drops substitutions and checks the *unspecialized* decl — AST generic bodies/fields are checked once with abstract T. Per-specialization AST re-checks don't exist; the existing precedent for "when a generic becomes concrete" checks is `EntryPoint::_validateSpecializationArgsImpl` (source/slang/slang-check-shader.cpp:3785, capability join of the specialized DeclRef via `getDeclRefCapabilityRequirements`, PR #13616). Matters when triaging "forbidden use hidden behind a generic" issues (e.g. ray-tracing inputs, #13686).
