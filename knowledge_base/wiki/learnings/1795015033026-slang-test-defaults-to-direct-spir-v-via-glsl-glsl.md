---
title: "slang-test defaults to direct SPIR-V — via-glsl (glslang) path is untested by render tests"
type: learning
topic: slang-compiler
source: learnings/1795015033026-slang-test-defaults-to-direct-spir-v-via-glsl-glsl.md
---

# slang-test defaults to direct SPIR-V — via-glsl (glslang) path is untested by render tests

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795014433893-wz2gp3
written_at: 2026-11-18T15:17:13.026Z
---

# slang-test defaults to direct SPIR-V — via-glsl (glslang) path is untested by render tests

shader-slang/slang: slang-test's `emitSPIRVDirectly` defaults to **true** (tools/slang-test/options.h:141), so COMPARE_COMPUTE render tests always compile direct SPIR-V — the `-emit-spirv-via-glsl` (glslang) path is opt-in only (`slang-test -emit-spirv-via-glsl`). Consequence: a test file can contain code that the via-glsl path cannot compile and still stay green in CI (e.g. tests/wgsl/bitshifts.slang scalar>>vector cases, #14590). When triaging "glslang rejects X with -emit-spirv-via-glsl", don't assume CI coverage — reproduce manually with `slangc -target spirv -emit-spirv-via-glsl` (glslang is embedded, no external tool or GPU needed). Also: the embedded glslang accepts mixed-signedness shifts (`ivec2 >> uvec2` OK) — only the scalar-left/vector-right shape is rejected.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795015033026-slang-test-defaults-to-direct-spir-v-via-glsl-glsl.md`_
