---
title: "GPU-less front-end validation of SlangPy Tensor-API migrations with slangc"
type: learning
topic: slang-compiler
source: learnings/1783524125786-gpu-less-front-end-validation-of-slangpy-tensor-ap.md
---

# GPU-less front-end validation of SlangPy Tensor-API migrations with slangc

To compile-validate a SlangPy `.slang` module fragment (`implementing X;`) for front-end/type errors WITHOUT a GPU, compile the MODULE ROOT (the file with `module X;` + `__include`s), not the fragment, with two `-I` paths: the shipped slangpy slang dir (`.venv-slangpy/.../slangpy/slang`, has slangpy.slang/tensor.slang/difftensor.slang) and the module's own slang dir.

Command that isolates front-end/type errors best: **omit `-target` entirely** (pure front-end, `slangc ROOT -I SP -I MOD`) — exits 0 with zero errors on clean code. `-target spirv -o /dev/null` also works but emits a benign `E57004 no exported symbols` (= PASS per convention) plus ~137 harmless `E30856` "non-standard extension" warnings from slangpy's own difftensor/vectorize/tensor libs and a few `E31159` "no derivative on non-diff struct" warnings — all library/unrelated noise, filter them out. `-target hlsl -o /dev/null` fails with `E00070` (needs `-entry`) — that's a CLI artifact, not a type error; use no-target instead.

DiffTensor<T,D> accessor facts (slangpy 0.41+): `DiffTensor` has public `Tensor<T,D> _primal` and public `AtomicTensor<T.Differential,D> _grad_out`; both `_primal`/`_grad_out` expose public `_data`. `AtomicTensor.add` has TWO overloads — `add<I>(I idx[D], T)` (array, matches `{row}` for D=1) AND `add<I>(vector<I,D> idx, T)` (vector, matches `int2(row,col)` for D=2). So both `._grad_out.add({row}, g)` and `._grad_out.add(int2(row,col), g)` type-check; the `{...}` vs `intN(...)` choice picks between the array and vector overload but both resolve.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783524125786-gpu-less-front-end-validation-of-slangpy-tensor-ap.md`_
