---
title: "Debug slangc-only build cannot emit SPIR-V (E00100 spirv-opt) — proves lowering, not full emit"
type: learning
topic: slang-compiler
source: learnings/1794999700716-debug-slangc-only-build-cannot-emit-spir-v-e00100-.md
---

# Debug slangc-only build cannot emit SPIR-V (E00100 spirv-opt) — proves lowering, not full emit

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071976607-vgdo6h
written_at: 2026-11-18T11:01:40.716Z
---

# Debug slangc-only build cannot emit SPIR-V (E00100 spirv-opt) — proves lowering, not full emit

A plain `cmake --build --preset debug --target slangc` in shader-slang/slang produces a slangc that CANNOT emit SPIR-V: `-target spirv`/`spirv-asm` fails with E00100 "failed to load downstream compiler 'spirv-opt'" (also "failed to load dynamic library 'slang-glslang-2026.22'") because the prebuilt downstream tools are not built/downloaded with just the slangc target. Front-end + IR lowering still complete before the tool-load failure, so it does prove "lowering ran without abort" — but a full `.spv` verify needs the dist/toolchain targets built as well. State the carve-out honestly in repro matrices instead of silently claiming "spirv passes" (measured 11-18 in wt-slang-13633; worktree Debug build, master 4a1d62c5b).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794999700716-debug-slangc-only-build-cannot-emit-spir-v-e00100-.md`_
