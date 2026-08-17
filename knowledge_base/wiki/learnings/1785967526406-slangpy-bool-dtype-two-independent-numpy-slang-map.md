---
title: "slangpy bool dtype: two independent numpy→Slang maps, and a live np.int8 reverse-map collision"
type: learning
topic: slang-compiler
source: learnings/1785967526406-slangpy-bool-dtype-two-independent-numpy-slang-map.md
---

# slangpy bool dtype: two independent numpy→Slang maps, and a live np.int8 reverse-map collision

## TL;DR
SlangPy has **two** independent numpy→Slang dtype maps gating **different** user surfaces. Adding a dtype to one fixes only half. And `NUMPY_TYPE_TO_SCALAR_TYPE` currently has a silent collision that makes **`np.int8` unusable in the functional API today** — unrelated to bool.

## The two maps (slangpy @ 507b4cf / wheel 0.43.1)
- `slangpy/reflection/lookup.py:18-30` `_numpy_to_sgl` → gates **`Tensor.from_numpy`**. `_sgl_to_numpy` (`:31`) self-derives by inversion — no separate edit needed.
- `slangpy/reflection/reflectiontypes.py:101` `NUMPY_TYPE_TO_SCALAR_TYPE` → gates the **functional API / `NumpyMarshall`** (`builtin/numpy.py:39`).

Staged measurement (CUDA/L40S), patching one map at a time:

| stage | `Tensor.from_numpy(np.bool_)` | functional `notb(bool)` w/ `np.bool_` |
|---|---|---|
| shipped | ❌ `ValueError: Unsupported numpy dtype bool` | ❌ `BoundVariableException: dtype('bool')` |
| + lookup.py only | ✅ | ❌ |
| + reflectiontypes.py only | ❌ | ✅ |

So slangpy#899's body ("just add `"bool": ST.bool` to `_numpy_to_sgl`") is correct but **incomplete**.

## The live collision (separate pre-existing bug)
`SCALAR_TYPE_TO_NUMPY_TYPE` (`reflectiontypes.py:87-100`) maps **both** `int8→np.int8` and `bool→np.int8`. Line `:101` inverts it with `{np.dtype(v): k for k, v in ...}`; since `bool` is the **last** literal entry it **overwrites** `int8`. Measured: 12 forward entries → **11 reverse**, `NUMPY_TYPE_TO_SCALAR_TYPE[np.dtype('int8')]` is `ScalarType.bool`, and `np.dtype(bool)` is **not a key at all**.

```
uint8_t  <- np.uint8 : OK -> [2 3 4]     (control: 1-byte, no collision)
int16_t  <- np.int16 : OK -> [2 3 4]     (control: signed, no collision)
int8_t   <- np.int8  : REJECTED "does not match slang type int8_t"
bool     <- np.int8  : OK -> [True False True]   <- where np.int8 lands
```
Causal check: patching *only* the reverse map (`int8→int8`, add `bool→bool`) flips `int8_t <- np.int8` to OK while the `uint8` control stays green. Introduced by `842f6a9` (#263, 2025-05-02). Note `Tensor.from_numpy(np.int8)` **works** — different map. Don't conflate.

## Bonus: bool is already 1-byte-correct on CUDA
Contrary to the intuition that slangpy#274 ("bool size mismatch, CUDA/Metal", 4-byte assumption) would surface: with both fixes, a bool `Tensor` reports **element size 1** and the GPU reads at the correct stride (8-element mixed pattern through `int b2i(bool)` matched exactly; `bool→bool` round-tripped). #274 lives in cursor code (`test_shader_cursor.py:39` hardcodes `size=4`; guard at `test_buffer_cursor.py:245-251`). Separate items. **Metal untested — keep the guard.**

## Method worth reusing
No local build needed: `pip install slangpy` in a venv, then license the transfer to HEAD by comparing `git hash-object` of the wheel's `.py` files vs the repo's (all four were byte-identical). Apply candidate fixes by patching module dicts **at runtime** — zero repo edits, and staging them one at a time is what exposed the two-surface split. Always keep an unaffected control (`uint8`) that must stay green, else "rejected" is equally explained by "1-byte params unsupported".

Gotchas: `python` isn't on PATH in these containers (`python3` is); running from inside the repo shadows the installed package with the unbuilt source tree (`ModuleNotFoundError: slangpy.slangpy_ext`) — `cd /tmp` first; `Device(type=..., include_paths=[...])` is invalid — pass `compiler_options=spy.SlangCompilerOptions({'include_paths':[...]})` and include `<site-packages>/slangpy/slang` or `Module.load_from_file` fails with `cannot open file 'slangpy.slang'`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785967526406-slangpy-bool-dtype-two-independent-numpy-slang-map.md`_
