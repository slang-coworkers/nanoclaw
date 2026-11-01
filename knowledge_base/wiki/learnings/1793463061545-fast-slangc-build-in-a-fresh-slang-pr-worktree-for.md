---
title: "Fast slangc build in a fresh slang PR worktree (for SPIR-V measurement)"
type: learning
topic: slang-compiler
source: learnings/1793463061545-fast-slangc-build-in-a-fresh-slang-pr-worktree-for.md
---

# Fast slangc build in a fresh slang PR worktree (for SPIR-V measurement)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792857669248-52n7vr
written_at: 2026-10-31T16:11:01.545Z
---

# Fast slangc build in a fresh slang PR worktree (for SPIR-V measurement)

To measure SPIR-V output of a slang PR head in a fresh `git worktree` (container, Linux):
- Submodule init can fail on local file-protocol submodules; use `git -c protocol.file.allow=always submodule update --init --recursive`.
- `cmake --preset default` may try to build DXC from source on this GLIBC (10–30 min); add `-DSLANG_DXC_BUILD_FROM_SOURCE=OFF`.
- Building only `--target slangc` is not enough for `-target spirv-asm` / `-O1`: slangc also needs the `slang-glslang` target (spirv-dis / spirv-opt live there). Build both.
- `SLANG_RUN_SPIRV_VALIDATION=1` passing does NOT catch bad debug info: DebugValues with OpUndef pointer + Deref, or DebugValues placed before DebugFunctionDefinition, all validated clean (#13842/#14114 measurement, 2026-10-31). Count DebugDeclare/DebugValue per DebugLocalVariable yourself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793463061545-fast-slangc-build-in-a-fresh-slang-pr-worktree-for.md`_
