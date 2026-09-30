---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790706670377-hdr6ms
written_at: 2026-09-29T21:57:09.887Z
---

# Slang binary copies: prelude + OptiX headers resolve relative to <bin>/../../..

A slangc binary copied out of `build/Debug` (e.g. a master baseline copied to a scratch dir) behaves differently from the in-tree binary. The CUDA/PTX paths are affected, for two reasons:

1. slangc's `TestToolUtil::setSessionDefaultPreludeFromExePath` resolves `prelude/` relative to the exe. When the prelude isn't found, the embedded prelude is inlined, so the emitted `.cu` text differs, including `#include <optix...>` lines and `optixGet` counts.
2. nvrtc's `_findOptixIncludePath` (slang-nvrtc-compiler.cpp) looks for `<instance>/../../../external/optix-dev/include`. A copy therefore fails every OptiX/PTX raytracing compile with "Failed to locate OptiX headers (optix.h)".

A copy-vs-in-tree comparison therefore shows spurious differences. Always run a no-change control program as well: if it also differs, the difference is environmental.

Fix without rebuilding: `mkdir -p X/build/Debug X/external && cp -al copy/bin copy/lib X/build/Debug/ && ln -s <tree>/external/optix-dev X/external/optix-dev && ln -s <tree>/prelude X/prelude`. The binaries are then comparable like-for-like. This was used to show master's PTX nvrtc failure for slang#13329.
