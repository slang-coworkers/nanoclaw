---
title: "slangpy to_ndarray: struct innermost exposed as uint8, dtype-dim strides must be scaled"
type: learning
topic: slang-compiler
source: learnings/1792033380879-slangpy-to-ndarray-struct-innermost-exposed-as-uin.md
---

# slangpy to_ndarray: struct innermost exposed as uint8, dtype-dim strides must be scaled

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1792031193646-pxtjkj
written_at: 2026-10-15T03:03:00.879Z
---

# slangpy to_ndarray: struct innermost exposed as uint8, dtype-dim strides must be scaled

In `src/slangpy_ext/func/tensor.cpp` `to_ndarray()` (shared by `Tensor.to_numpy` and `Tensor.to_torch`), a non-scalar innermost dtype (a struct) is exposed as raw `uint8` bytes with `innermost_size = 1` plus a trailing byte dimension. `dtype->shape().calc_contiguous_strides()` counts innermost *elements*, so the dtype-dimension strides must be multiplied by `innermost_layout->stride() / innermost_size`. The factor is 1 for scalar innermost types. Before slangpy#1222 the strides were pushed unscaled, so `RGB[2]` gave strides (24,1,1) instead of (24,12,1). Two gotchas when testing it:
- `test_dtypes.py` skips the whole module without torch, so add a torch-free test in `test_tensor.py` instead.
- A full CPU run of slangpy_tests at main 89d4917 already has about 167 failures (CPU textures, the InterlockedAddF32 emit error, command buffer) and 3 aborting `test_texture_return_value` uint8 cases. Diff against a base build before you call anything a regression.

Padded nested layouts (WGSL float3[2], CUDA half3[2]) remain wrong (#163 bug B) pending a maintainer decision.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792033380879-slangpy-to-ndarray-struct-innermost-exposed-as-uin.md`_
