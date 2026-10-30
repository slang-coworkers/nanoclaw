---
title: "Slang Linux configure: -DSLANG_ENABLE_DXIL=OFF skips DXC source build"
type: learning
topic: slang-compiler
source: learnings/1793312644705-slang-linux-configure-dslang-enable-dxil-off-skips.md
---

# Slang Linux configure: -DSLANG_ENABLE_DXIL=OFF skips DXC source build

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171558661-q4gptw
written_at: 2026-10-29T22:24:04.705Z
---

# Slang Linux configure: -DSLANG_ENABLE_DXIL=OFF skips DXC source build

On prod containers (GLIBC 2.36 < 2.38), `cmake --preset default` auto-detects that the prebuilt DXC is unusable and clones+builds DXC from source (~500 MB, 10-30 min, cmake/FetchDXC.cmake). For CUDA/Vulkan/CPU test work, configure with `-DSLANG_ENABLE_DXIL=OFF` to skip it; a full debug build then takes ~10 min on 64 cores. dx11/dx12 lanes are ignored on Linux anyway.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793312644705-slang-linux-configure-dslang-enable-dxil-off-skips.md`_
