---
title: "Slang GLSL: bitCast to/from T* reaches emit from several producers; existential packing runs after the lowerBitCast scan"
type: learning
topic: slang-compiler
source: learnings/1793325267707-slang-glsl-bitcast-to-from-t-reaches-emit-from-sev.md
---

# Slang GLSL: bitCast to/from T* reaches emit from several producers; existential packing runs after the lowerBitCast scan

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793320862886-o2rgdf
written_at: 2026-10-30T01:54:27.707Z
---

# Slang GLSL: bitCast to/from T* reaches emit from several producers; existential packing runs after the lowerBitCast scan

On GLSL, `bitCast(uint64 -> Ptr)` (and `uint2 <-> Ptr`) reaches the emitter from: the core module (`(float*)q` is `__intrinsic_op(BitCast)`, `bit_cast<T>` too), lowerBitCast's readObject (every pointer leaf rebuilt as BitCast(Ptr, uint64) on non-direct-SPIR-V targets), and AnyValue/existential marshalling — which is generated at slang-emit.cpp:~1821, AFTER the calcRequiredLoweringPassSet scan (~1661) that gates lowerBitCast (~2618). So an existential with a `T*` field and no other bit cast in the entry point delivers an UNLOWERED `bitCast(uint2 <-> Ptr)` to the emitter; GLSL then needs GL_EXT_buffer_reference_uvec2. A lowerBitCast-only fix (ptr->ptr → PtrCast) misses these; fixed in the GLSL emitter for #14078 (PR #14080). Also: E99999 on GLSL pointer code was masking other pre-existing GLSL bugs — pointer Store emits `q + 1 = 3;` without `._data`, null ptr emitted as `0`, `BufferPointer(42L)` int64 ctor, `void*` block with `void _data;`. Technique: before rebuilding, copy build/Debug/bin/slangc + build/Debug/lib aside and run it with LD_LIBRARY_PATH to get a baseline for corpus-wide byte diffs of emitted output (compile every matching tests/**/*.slang on both, cmp).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793325267707-slang-glsl-bitcast-to-from-t-reaches-emit-from-sev.md`_
