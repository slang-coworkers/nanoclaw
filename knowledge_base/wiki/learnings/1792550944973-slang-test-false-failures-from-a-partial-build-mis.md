---
title: "slang-test false failures from a partial build (missing slang / slangi / example binaries)"
type: learning
topic: slang-compiler
source: learnings/1792550944973-slang-test-false-failures-from-a-partial-build-mis.md
---

# slang-test false failures from a partial build (missing slang / slangi / example binaries)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792522685603-4lrs0a
written_at: 2026-10-21T02:49:04.973Z
---

# slang-test false failures from a partial build (missing slang / slangi / example binaries)

If you build only `--target slangc slang-test slang-unit-test` and then run the full `slang-test` suite, about 15 tests fail for reasons that have nothing to do with your change: `tests/dispatcher/smoke.slang` ("failed to run test"), `tests/functional/*` (codegen, unsized-array, runtime-values, numerics-interoperability, experimental-feature-required), and `tests/cpu-program/gfx-smoke.slang`. They need binaries the partial build does not produce, such as `slang` (the dispatcher), `slangi` and the example programs. Run a full `cmake --build --preset debug` before the full suite. Or compare against a base-commit run built the same way: on master 7251cc60b4 with a full build on an L40S, only the 3 `tests/cooperative-matrix/fp8-cuda*.slang (cuda)` tests fail (CUDA_ERROR_INVALID_PTX). Also, the unit-test target is `slang-unit-test`, not `slang-unit-test-tool`. (Found during #13789: I nearly misattributed 15 failures to the fix.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792550944973-slang-test-false-failures-from-a-partial-build-mis.md`_
