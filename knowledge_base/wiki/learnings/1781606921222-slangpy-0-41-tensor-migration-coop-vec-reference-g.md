---
title: "slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main"
type: learning
topic: slang-compiler
source: learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md
---

# slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main

Findings from validating slangpy-samples#45 (complete the 0.41 Tensor-API migration). Verified against slangpy main (commit d1c765e) + remote fetches.

**New 0.41 Slang Tensor API (vs old GradOutTensor/NDBuffer):**
- `DiffTensor<T,D>` (slangpy/slang/difftensor.slang:374) = `Tensor<T,D> _primal` + `AtomicTensor<T.Differential,D> _grad_out`. Old `.primal.buffer`/`.d_out.buffer` → `._primal._data` / `._grad_out._data`.
- `Tensor._data` = `StorageTraits<T>::BufferType` = `StructuredBuffer<T>` OR `T*` (core.slang:82-86). `AtomicTensor._data` = `StorageTraits<T>::AtomicBufferType` = `RWByteAddressBuffer` OR `T*` (atomics.slang). i.e. grad_out's buffer is an ATOMIC buffer, not plain RW.
- `RWNDBuffer`/`NDBuffer` are GONE from the Slang runtime API (only survive in generated test fixtures). Replacements (tensorupdate.rst step 3): function param `NDBuffer`→`ITensor`, `RWNDBuffer`→`IRWTensor`; variable `NDBuffer`→`Tensor`. `GradOutTensor`→`IDiffTensor` (param) / concrete `DiffTensor` (when you must touch grad buffers — step 5).

**Two non-obvious gotchas:**
1. Coop-vec layer migration has NO clean upstream reference. `shader-slang/neural-shading-s25#10` ("Support new slangpy version", MERGED) is often cited as the reference, but it only migrated `network/*` + `mipmap/*` — none use coop-vec. That repo's coop-vec code is a standalone C++ example (`hardware-acceleration/mlp-training-coopvec/mlp.slang`) #10 never touched. So whether `coopVecMatMulAdd`/`coopVecOuterProductAccumulate`/etc. accept the new `_data` buffer types (StructuredBuffer / atomic RWByteAddressBuffer) is unverified and needs coop-vec-capable HW to settle. Treat coop-vec migrations as blocked-on-HW, not a mechanical search-replace.
2. Python `spy.NDBuffer` is reportedly a deprecated alias at 0.42.0, but on current main it is ENTIRELY removed — no symbol, no `__getattr__` shim in slangpy/__init__.py, no native binding (changelog: removal under 0.41.0 / PR #697). So "NDBuffer still resolves" is version-pinned; don't assume the alias exists on main.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md`_
