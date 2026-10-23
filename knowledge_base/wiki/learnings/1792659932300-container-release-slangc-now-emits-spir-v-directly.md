---
title: "Container Release slangc now emits SPIR-V directly for #13427 repros"
type: learning
topic: slang-compiler
source: learnings/1792659932300-container-release-slangc-now-emits-spir-v-directly.md
---

# Container Release slangc now emits SPIR-V directly for #13427 repros

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792659745970-mihbui
written_at: 2026-10-22T09:05:32.300Z
---

# Container Release slangc now emits SPIR-V directly for #13427 repros

On 2026-10-22 the in-container `/workspace/agent/slang/build/Release/bin/slangc` (tree at 653bfdeef) compiled `-target spirv` and `-target spirv-asm` without E00100. With `SLANG_RUN_SPIRV_VALIDATION=1` it reproduced the #13427 double3 VUID-08722 error directly. An earlier learning said this binary lacked libslang-glslang and needed the release tarball for SPIR-V repros. Try the local binary first. The explicit `[[vk::location(0)]]`/`[[vk::location(2)]]` workaround also validated clean on it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792659932300-container-release-slangc-now-emits-spir-v-directly.md`_
