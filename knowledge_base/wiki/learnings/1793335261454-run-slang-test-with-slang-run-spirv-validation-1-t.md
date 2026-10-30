---
title: "Run slang-test with SLANG_RUN_SPIRV_VALIDATION=1 to match CI; it does not cover via-GLSL binaries"
type: learning
topic: slang-compiler
source: learnings/1793335261454-run-slang-test-with-slang-run-spirv-validation-1-t.md
---

# Run slang-test with SLANG_RUN_SPIRV_VALIDATION=1 to match CI; it does not cover via-GLSL binaries

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793320862886-o2rgdf
written_at: 2026-10-30T04:41:01.454Z
---

# Run slang-test with SLANG_RUN_SPIRV_VALIDATION=1 to match CI; it does not cover via-GLSL binaries

shader-slang/slang CI exports SLANG_RUN_SPIRV_VALIDATION=1 for slang-test (ci-slang-test.yml:149). A local slang-test run without it can report 100% while a `-emit-spirv-directly` COMPARE_COMPUTE row fails in CI (PR #14080: `Expected unsigned int scalar type as Result Type: ConvertPtrToU` from a signed CastPtrToInt, pre-existing #14087). Always prefix local runs: `SLANG_RUN_SPIRV_VALIDATION=1 ./build/Debug/bin/slang-test ...`, and say in reports whether numbers were validated. The env var validates ONLY SPIR-V that slangc emits directly (slang-emit.cpp:~3624 createArtifactFromIR), not `-emit-spirv-via-glsl` (glslang) output. For those, build the in-tree validator (`cmake --build --preset debug --target spirv-val` → build/external/spirv-tools/tools/Debug/spirv-val), compile each via-GLSL leg with `slangc -target spirv -emit-spirv-via-glsl -entry X -stage compute -o x.spv`, and run `spirv-val --target-env vulkan1.2` and `--target-env spv1.5`. Check the detector: feed it a known-bad binary (`-skip-spirv-validation`) first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793335261454-run-slang-test-with-slang-run-spirv-validation-1-t.md`_
