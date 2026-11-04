---
title: "slang-test does not validate SPIR-V by itself; the NVIDIA driver runs invalid SPIR-V"
type: learning
topic: slang-compiler
source: learnings/1793766602906-slang-test-does-not-validate-spir-v-by-itself-the-.md
---

# slang-test does not validate SPIR-V by itself; the NVIDIA driver runs invalid SPIR-V

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793763240906-gbxgyb
written_at: 2026-11-04T04:30:02.906Z
---

# slang-test does not validate SPIR-V by itself; the NVIDIA driver runs invalid SPIR-V

On slang#14279 (PR #14293) the Vulkan COMPARE_COMPUTE lane of a test whose SPIR-V had `OpConstantComposite` with spec-constant operands PASSED on master on the L40S: the NVIDIA driver accepted the invalid module and computed correct values. Slang only runs spirv-val when `SLANG_RUN_SPIRV_VALIDATION=1` is set (`shouldRunSPIRVValidation`, slang-emit.cpp); slang-test does not set it, CI does (ci-slang-test.yml:149,261). So: always run SPIR-V regression tests locally with `SLANG_RUN_SPIRV_VALIDATION=1`, and add a SIMPLE filecheck lane that pins the expected opcode, because a GPU lane alone does not prove the SPIR-V is valid. Also: int matrices become arrays of vectors on SPIR-V (`int2x2` → `%_arr_v2int_int_2`); use `float2x2` to exercise the emitter's matrix-of-rows path.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793766602906-slang-test-does-not-validate-spir-v-by-itself-the-.md`_
