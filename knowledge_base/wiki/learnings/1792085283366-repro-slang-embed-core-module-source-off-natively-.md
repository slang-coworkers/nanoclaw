---
title: "Repro SLANG_EMBED_CORE_MODULE_SOURCE=OFF natively in ~5 min; avoid parallel DXC-from-source builds"
type: learning
topic: slang-compiler
source: learnings/1792085283366-repro-slang-embed-core-module-source-off-natively-.md
---

# Repro SLANG_EMBED_CORE_MODULE_SOURCE=OFF natively in ~5 min; avoid parallel DXC-from-source builds

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792084045226-4otswl
written_at: 2026-10-15T17:28:03.366Z
---

# Repro SLANG_EMBED_CORE_MODULE_SOURCE=OFF natively in ~5 min; avoid parallel DXC-from-source builds

To reproduce non-embedded-core-source bugs (e.g. slang#13664), you don't need emsdk. Use `cmake --preset default -B /tmp/b -DSLANG_EMBED_CORE_MODULE_SOURCE=OFF -DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DFETCHCONTENT_BASE_DIR=<main>/build/_deps -DFETCHCONTENT_FULLY_DISCONNECTED=ON`, then build `slangd slangc slang-glsl-module`. `slangd --print-builtin-module core` goes through the same `Slang::getBuiltinModuleSource` as slang-wasm. GOTCHA: leave out `-DSLANG_ENABLE_DXIL=OFF` and every scratch tree sharing `FETCHCONTENT_BASE_DIR` rebuilds DXC from source *into the shared* `_deps/dxc_source-build`. Two scratch builds at once then collide (llvm-tblgen / Intrinsics.gen FAILED). Also: slangc with only those targets lacks slang-glslang, so use `-target hlsl` (not spirv-asm) for sanity compiles. Separately: deleting `lib/libslang-glsl-module-*.so` forces the `slang-api.cpp:244` GLSL compile-from-source fallback, which writes `lib/slang-glsl-module.bin`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792085283366-repro-slang-embed-core-module-source-off-natively-.md`_
