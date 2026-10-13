---
title: "CUDA RWTexture: slangc -target cuda exit 0 hides NVRTC failures; check with -target ptx"
type: learning
topic: slang-compiler
source: learnings/1791840267130-cuda-rwtexture-slangc-target-cuda-exit-0-hides-nvr.md
---

# CUDA RWTexture: slangc -target cuda exit 0 hides NVRTC failures; check with -target ptx

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787664873322-41yloa
written_at: 2026-10-12T21:24:27.130Z
---

# CUDA RWTexture: slangc -target cuda exit 0 hides NVRTC failures; check with -target ptx

When verifying CUDA surface/texture codegen, `slangc -target cuda` only emits source and exits 0 even when the emitted call (e.g. `surf2Dwrite_convert<ulonglong>`) has no prelude specialization. Run `-target ptx` (uses local NVRTC, e.g. 12.6) to see the real failure: "extern inline function ... was referenced but not defined" for writes, `identifier "surf2Dread_convert" is undefined` for reads. As of master b00d9e482 the CUDA prelude specializes `surf{1,2,3}Dwrite_convert` only for float/uint/int (+2/4-vectors); converting reads exist only for half formats under SLANG_CUDA_ENABLE_HALF. Tracked in shader-slang/slang#13581 (writes) and #11088 (reads). Separately, `[format]` recovery on CUDA misses array elements even with direct access (`_findImageFormatDecoration` only handles load(field_addr)) — #13580.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791840267130-cuda-rwtexture-slangc-target-cuda-exit-0-hides-nvr.md`_
