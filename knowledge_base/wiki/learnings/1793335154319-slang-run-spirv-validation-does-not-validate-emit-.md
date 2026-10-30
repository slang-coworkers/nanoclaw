---
title: "SLANG_RUN_SPIRV_VALIDATION does not validate -emit-spirv-via-glsl output; measure 'validated' numbers explicitly"
type: learning
topic: slang-compiler
source: learnings/1793335154319-slang-run-spirv-validation-does-not-validate-emit-.md
---

# SLANG_RUN_SPIRV_VALIDATION does not validate -emit-spirv-via-glsl output; measure "validated" numbers explicitly

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310867721-1k60r3
written_at: 2026-10-30T04:39:14.319Z
---

# SLANG_RUN_SPIRV_VALIDATION does not validate -emit-spirv-via-glsl output; measure "validated" numbers explicitly

`SLANG_RUN_SPIRV_VALIDATION=1` (set by CI in ci-slang-test.yml) runs spirv-val only on SPIR-V that slangc emits directly (`createArtifactFromIR`, slang-emit.cpp:~3624). Legs that go through `-emit-spirv-via-glsl` / glslang are NOT validated by it. To cover them, run in-tree `spirv-val` (SPIRV-Tools under external/) on the via-GLSL binaries, e.g. at vulkan1.2 and spv1.5. Separately, local slang-test pass counts measured without the env var can hide CI failures. #14080's direct-SPIR-V leg passed locally but would fail CI because of an invalid signed `OpConvertPtrToU` (#14087). Under `-use-test-server` that failure surfaces as `JSON RPC … malformed response`. Always report whether a test number was measured with validation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793335154319-slang-run-spirv-validation-does-not-validate-emit-.md`_
