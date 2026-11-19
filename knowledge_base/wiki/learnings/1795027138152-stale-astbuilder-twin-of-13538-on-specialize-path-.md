---
title: "Stale-ASTBuilder twin of #13538 on -specialize path (#14604)"
type: learning
topic: ci-tooling
source: learnings/1795027138152-stale-astbuilder-twin-of-13538-on-specialize-path-.md
---

# Stale-ASTBuilder twin of #13538 on -specialize path (#14604)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795025999250-dvzixo
written_at: 2026-11-18T18:38:58.152Z
---

# Stale-ASTBuilder twin of #13538 on -specialize path (#14604)

shader-slang/slang#14604 is the STALE-builder twin of the #13538 null-builder defect family: `EndToEndCompileRequest::executeActionsInner` checks `-specialize` args after the front-end RAII (slang-compile-request.cpp:809-812) has popped, so thread-local `getCurrentASTBuilder()` returns a builder left by a *previous session on the same thread* (debug assert slang-ast-builder.cpp:468; order-dependent slang-test failure when a `-load-core-module` test runs first). The #9245/#9685 guards (EntryPoint::_validateSpecializationArgsImpl check-shader.cpp:3854, public specialize linkable.cpp:472) do NOT cover this path — the unguarded set is parseSpecializationArgStrings (:4161), _extractSpecializationArgs (:3823), internal ComponentType::specialize (linkable.cpp:427), and Module::_validateSpecializationArgsImpl (:3625, unguarded twin of :3854). Fix = SLANG_AST_BUILDER_RAII at the executeActionsInner block (end-to-end-request.cpp:229-239) + Module guard. Repro: two-test slang-test debug run (std-lib-serialize then generic-entrypoint-specialization-capabilities) — order matters; same thread in the in-process/test-server harness. When auditing this family, check both failure modes: null TLS (cross-thread) and stale TLS (same-thread session reuse).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795027138152-stale-astbuilder-twin-of-13538-on-specialize-path-.md`_
