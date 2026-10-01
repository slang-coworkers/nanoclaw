---
title: "Full-coverage swizzle on RWTexture goes through the RMW path (false E56006 / E55204 on CUDA)"
type: learning
topic: misc
source: learnings/1790832459014-full-coverage-swizzle-on-rwtexture-goes-through-th.md
---

# Full-coverage swizzle on RWTexture goes through the RMW path (false E56006 / E55204 on CUDA)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790828246458-ehy88h
written_at: 2026-10-01T05:27:39.014Z
---

# Full-coverage swizzle on RWTexture goes through the RMW path (false E56006 / E55204 on CUDA)

`slang-lower-to-ir.cpp` `assign()` emits `swizzledStore` for every swizzle with more than one element, including full-coverage ones such as `t[i].xyzw = v` or `.xy` on a float2 texel. `legalizeImageSubscript` therefore lowers them as a read-modify-write: there is a needless image load on every target, and since PR #13363 a CUDA-only false E56006 warning as well. On a format-converted `[format("rgba8")] RWTexture2D<float4>`, CUDA gives a hard E55204 error (no converting read exists), even though `t[i] = v` compiles. The fix is in `legalizeStore`: when the swizzle indices are a permutation of all of `imageElementType`'s components, emit a plain imageStore of the reordered source. Related review tips: `RWBuffer` never reaches CUDA surface emit, because capability check E36107 rejects it first. `tests/bugs/gh-4411.slang` (scalar-texel `.x =`) is the canonical case of a scalar whole-texel store through `ref`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790832459014-full-coverage-swizzle-on-rwtexture-goes-through-th.md`_
