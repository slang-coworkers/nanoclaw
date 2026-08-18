---
title: "Slang normal-map/TBN debugging: mul arg-order + NaN-tangent chain"
type: learning
topic: slang-compiler
source: learnings/1784305210428-slang-normal-map-tbn-debugging-mul-arg-order-nan-t.md
---

# Slang normal-map/TBN debugging: mul arg-order + NaN-tangent chain

Multi-turn Discord support case (thread 1527701386354098277, user wide0125, 2026-07-17) debugging "normal map looks wrong" in Slang. Two distinct bugs, resolved in sequence:

**Bug 1 — `mul` argument order.** User had `TBN = float3x3(T, B, N)` then `mul(TBN, float3(0,0,1))`. In Slang/HLSL: `float3x3(T,B,N)` puts the vectors as ROWS; `mul(matrix, vector)` treats the vector as a COLUMN → returns `(dot(T,v), dot(B,v), dot(N,v))` = `(T.z,B.z,N.z)` for `(0,0,1)`, NOT the geometric normal. Fix: put vector first — `mul(float3(0,0,1), TBN)` (row-vector interp) = `n.x*T + n.y*B + n.z*N`. Equivalent: `mul(transpose(TBN), v)`. Authoritative doc: docs/user-guide/a1-01-matrix-layout.md — `mul(v,m)`→v is row vector, `mul(m,v)`→v is column vector; `mul(v,m)==mul(transpose(m),v)`. Memory-layout mode (row/col-major) is INDEPENDENT of this and irrelevant for in-shader-built matrices.

**Key debugging insight:** the flat `(0,0,1)` test ONLY exercises the N row — T and B are multiplied by 0, so a broken tangent basis is INVISIBLE in that test. "Flat works" does NOT validate T/B.

**Bug 2 — missing/zero tangent attribute (the real one).** Sampled normal map still wrong. Ruled out: sRGB (format was BC7_UNORM_BLOCK = linear full-RGBA; Slang does NO sRGB decode, it's hardware/format-driven), BC5 2-channel, green-channel convention (n.y flip did nothing). Decisive diagnostic: `return float4(T*0.5+0.5, 1)` rendered BLACK, not gray 0.5. **Black = NaN = normalize((0,0,0))**; gray 0.5 = a genuine zero vector. So `input.tangent.xyz` was arriving as zero — mesh has no TANGENT attribute or it's not wired in the input layout (unbound vertex attrs read as zero/undefined). Fixes: (a) generate tangents CPU-side (MikkTSpace / assimp aiProcess_CalcTangentSpace); (b) derive TBN in-shader from screen-space derivatives — `ddx/ddy` of worldPos & UV — which Slang supports on SPIR-V/Vulkan (OpDPdx/OpDPdy) and Metal.

**Reusable diagnostic ladder for "normal map wrong" in any shader lang:** 1) test flat (0,0,1) — validates mul-order + N only. 2) render raw sampled normal as color — light-blue = data OK, isolates texture-side (sRGB/BC5/format) vs basis. 3) render T, B, N each as color — BLACK means NaN (normalize of zero → check for unbound/garbage tangent attribute), gray-flat means constant/degenerate. This ladder localizes the bug in ~3 exchanges. `normalize(0)` in Slang is implementation-defined (NaN in practice) — a great signal, and worth guarding: `if (dot(t,t) < 1e-6) ...`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784305210428-slang-normal-map-tbn-debugging-mul-arg-order-nan-t.md`_
