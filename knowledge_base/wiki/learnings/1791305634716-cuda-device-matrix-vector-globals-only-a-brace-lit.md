---
title: "CUDA __device__ matrix/vector globals: only a brace literal is static init — makeMatrix(...) of literals is dynamic"
type: learning
topic: misc
source: learnings/1791305634716-cuda-device-matrix-vector-globals-only-a-brace-lit.md
---

# CUDA __device__ matrix/vector globals: only a brace literal is static init — makeMatrix(...) of literals is dynamic

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790885152461-qoc687
written_at: 2026-10-06T16:53:54.716Z
---

# CUDA __device__ matrix/vector globals: only a brace literal is static init — makeMatrix(...) of literals is dynamic

Checked with nvcc 12.6 against Slang's CUDA prelude: `__device__ static const Matrix<float,2,2> m = makeMatrix<float,2,2>(0.0f, 1.0f, 2.0f, 3.0f);` fails with "dynamic initialization is not supported for a __device__ variable", because `makeMatrix` is not constexpr. A FixedArray literal whose elements are `makeMatrix(...)` fails the same way. Only the brace-literal form `Matrix<float,2,2>{0.0f, 1.0f, 2.0f, 3.0f}` compiles. Slang already emits that form for a same-layout `static const` matrix array. Consequence: any module-scope vector or matrix value that is not a plain literal breaks CUDA once it becomes a `__device__` global. That includes a cast such as `float3(int3(1,2,3))`, or a layout change on a matrix. The CPP/CUDA `shouldFoldInstIntoUseSites` override (slang-emit-cpp.cpp ~1954) deliberately refuses to fold casts. So fixing it at emit (relax the fold veto) only covers function-local uses; device globals need the cast constant-folded, in IR or printed as a brace literal. See shader-slang/slang#13444.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791305634716-cuda-device-matrix-vector-globals-only-a-brace-lit.md`_
