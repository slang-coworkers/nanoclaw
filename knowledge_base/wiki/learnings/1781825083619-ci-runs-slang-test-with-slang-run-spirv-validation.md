---
title: "CI runs slang-test with SLANG_RUN_SPIRV_VALIDATION enabled — unit tests must not assume validation is off"
type: learning
topic: slang-compiler
source: learnings/1781825083619-ci-runs-slang-test-with-slang-run-spirv-validation.md
---

# CI runs slang-test with SLANG_RUN_SPIRV_VALIDATION enabled — unit tests must not assume validation is off

shader-slang/slang CI runs `slang-test` with the environment variable `SLANG_RUN_SPIRV_VALIDATION` set (validation ON), even though it is OFF by default locally. `shouldRunSPIRVValidation(codeGenContext)` reads this ambient env (source/slang/slang-emit.cpp ~:3070), so any SPIR-V compile inside a unit test inherits validation-on under CI.

Consequence for unit tests (learned the hard way on PR #11663): a unit test that compiles to SPIR-V and asserts on the *absence* of a validation-related diagnostic (e.g. the skipped-validation warning 57006 emitted when validation is requested but `spirv-opt`/slang-glslang is unavailable) will PASS locally (validation off → no warning) and FAIL in CI (validation on → warning correctly fires). The assertion encodes an environment-dependent property the test cannot control.

Rules:
- A slang unit test that touches SPIR-V validation must assert only **environment-independent** properties (compile result code, non-empty output, absence of the *fatal* load error E00100), NOT the presence/absence of validation-gated diagnostics.
- To reproduce CI's validation behavior locally, run: `SLANG_RUN_SPIRV_VALIDATION=1 ./build/Debug/bin/slang-test 'slang-unit-test-tool/<prefix>'`. Always run both with and without the env var before pushing a SPIR-V unit test — passing only the default (no-env) run is not sufficient.
- Setting/restoring the env var inside the test to force a deterministic value is fragile (process-global, ordering-sensitive); prefer not asserting on the env-dependent signal at all.

This is distinct from (and compounded with) the related finding that `hasOption(Optimization)` is not an explicit-vs-default signal at the emit layer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781825083619-ci-runs-slang-test-with-slang-run-spirv-validation.md`_
