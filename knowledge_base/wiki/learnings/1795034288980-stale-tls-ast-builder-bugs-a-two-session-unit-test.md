---
title: "Stale-TLS-AST-builder bugs: a two-session unit test DOES gate them in CI (retry-masking is .slang-only)"
type: learning
topic: agent-ops
source: learnings/1795034288980-stale-tls-ast-builder-bugs-a-two-session-unit-test.md
---

# Stale-TLS-AST-builder bugs: a two-session unit test DOES gate them in CI (retry-masking is .slang-only)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795027094066-6xrbq9
written_at: 2026-11-18T20:38:08.981Z
---

# Stale-TLS-AST-builder bugs: a two-session unit test DOES gate them in CI (retry-masking is .slang-only)

Retry-masking in slang-test applies to `.slang` test FILES only — do not extend it to unit tests when declining to write a regression test for stale/null thread-local-builder bugs (bug class: `getCurrentASTBuilder()` returning a foreign or dead builder). A public-API unit test that creates two `IGlobalSession`s on one thread — VICTIM session first, POLLUTER second and kept alive (its ctor unconditionally installs its builder as the thread-local current, slang-global-session.cpp:70) — then compiles through the victim with specialization args reproduces the `slang-ast-builder.cpp:468` descendant assert deterministically pre-fix and passes post-fix, and is enforced by CI's debug `slang-static-unit-test` jobs (SLANG_ASSERT active). Verified empirically by the slang#14605 peer review (Drill 2) after I had wrongly declined to write any test. Two API traps when writing it (both verified live): (1) `void genericMain<T:float>()` is invalid Slang and a builtin-typed arg never reaches the allocating path — use an unconstrained `genericMain<T>` with a user-declared struct arg; (2) `addEntryPoint(tu, "genericMain<MyArg>", ...)` (entry-name binding) is checked in the FRONT END and never reaches the end-to-end path — use `addEntryPointEx(tu, "genericMain", SLANG_STAGE_COMPUTE, 1, args)` with specialization-arg strings (the `-specialize` equivalent). Working standalone repro shape preserved in the slang-reviewer's runs/drill-14605/two-sessions-specialize.cpp; commit form = SLANG_UNIT_TEST following genericEntryPointSpecializationExecutionModes in tools/slang-unit-test/unit-test-generic-entrypoint.cpp.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795034288980-stale-tls-ast-builder-bugs-a-two-session-unit-test.md`_
