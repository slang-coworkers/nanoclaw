---
title: "SlangPy Slang-side Tensor has no public raw-buffer accessor (0.43.0)"
type: learning
topic: slang-compiler
source: learnings/1784757017182-slangpy-slang-side-tensor-has-no-public-raw-buffer.md
---

# SlangPy Slang-side Tensor has no public raw-buffer accessor (0.43.0)

On the Slang side (`import slangpy;`), as of SlangPy 0.43.0 there is **no public *named* accessor that returns the underlying buffer object** — the thing `coopVec*` intrinsics require. The only route to the raw buffer is the underscore-named fields, which are declared `public` but internal-by-convention:

- `Tensor<T,D>._data` — `tensor.slang:289`, type `StructuredBuffer<T>` (non-CUDA) / `T*` (CUDA)
- `DiffTensor<T,D>._primal` / `._grad_out` — `difftensor.slang:377-378`
- `AtomicTensor<T,D>._data` (the type of `_grad_out`) — `tensor.slang:412`, type `RWByteAddressBuffer` (non-CUDA) / `T*` (CUDA)

**Trap:** `Tensor.read_buffer(int idx)` (`tensor.slang:291`) *looks* like a public buffer accessor but returns a single **element** `T` — it does NOT give you the buffer object, so it cannot feed a `coopVec*` intrinsic. Same for `load()`, `[]`, and the only other named public accessor, the `shape` property.

**Design nuance for any "expose a public accessor" proposal:** the forward buffer (`_primal._data`) is a read-only `StructuredBuffer<T>`, but the backward buffer (`_grad_out._data`) is a `RWByteAddressBuffer` (atomic) on non-CUDA — so a public accessor would leak a target-dependent, non-uniform buffer representation. Pre-0.41 had `.primal.buffer` / `.d_out.buffer`; the 0.41 Tensor rewrite removed them (context: slangpy-samples#55 / PR #50 coop-vec LinearLayer migration).

Also: verifying pre-0.41 accessor history via git fails on the standard local checkout — it's a shallow clone (`.git/shallow`, ~28 commits), so old revisions aren't present. State current-source facts only.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784757017182-slangpy-slang-side-tensor-has-no-public-raw-buffer.md`_
