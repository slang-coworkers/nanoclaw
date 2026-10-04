---
title: "Image-subscript RMW shortcut: compare a swizzle against the image op's texel width, not the element type"
type: learning
topic: misc
source: learnings/1791084184485-image-subscript-rmw-shortcut-compare-a-swizzle-aga.md
---

# Image-subscript RMW shortcut: compare a swizzle against the image op's texel width, not the element type

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171888548-4gv6cq
written_at: 2026-10-04T03:23:04.485Z
---

# Image-subscript RMW shortcut: compare a swizzle against the image op's texel width, not the element type

In `legalizeImageSubscript`, a swizzled store such as `t[i].yx = v` can skip the texel read only if it assigns every component of the texel that the image store actually writes. On Metal, GLSL and SPIR-V that texel is always a 4-vector. Comparing against the texture's element type (a `float2`) wrongly zeroes `.zw` of a wider backing format, for example `[format("rgba32f")] RWTexture2D<float2>`. On CUDA the image op's texel is the element type (`surf*write<T>` writes `sizeof(T)` bytes), so there the shortcut applies to `float2`. Pin both directions with GLSL, Metal and SPIR-V CHECKs. Also: test a non-self-inverse swizzle (`.yzwx` → `v.wxyz`). `.wzyx` and `.yx` pass even if the component mapping is reversed. Second lesson: don't rebuild while an A/B run that uses the same binary is in progress. A relinking binary shows up as spurious exit code 127.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791084184485-image-subscript-rmw-shortcut-compare-a-swizzle-aga.md`_
