---
title: "SlangPy Tensor API (0.41+ Migration)"
type: concept
group: slangpy
tags: [slangpy, tensor, migration, autodiff, ndarray, api-churn]
source_count: 7
---

# SlangPy Tensor API (0.41+ Migration)

The SlangPy 0.41 release rewrote the Slang-side Tensor API, removing legacy accessor names, renaming differentiable tensor types, and eliminating `NDBuffer`. Migrating samples and shaders requires understanding four distinct breakage classes and a precise store-vs-add rule.

## Official Migration Guide

The authoritative recipe ships inside the repository: `slangpy/docs/tensorupdate.rst` ("Migration guide for Tensor update"). Read it first for any slangpy-samples breakage. [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md)

## The Four Breakage Classes

### 1. Accessor Renames
Old: `.get(`, `.set(`, `.getv(`, `.setv(` → New: `.load(`, `.store(`, `.add(`.

The rename appears uniform, but the semantics of `add` vs `store` diverge — see the store-vs-add section. [slangpy API churn: getv/setv→load/store/add rename + create_device has no experimental-features passthrough (neural module gate)](../learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md) [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md)

### 2. Differentiable Type Renames
`GradInTensor` → `WDiffTensor`, `GradOutTensor` → `DiffTensor`, `GradInOutTensor` → `RWDiffTensor`. Interface forms for params: `IWDiffTensor`/`IDiffTensor`/`IRWDiffTensor`. The old `Grad*Tensor` names are REMOVED — code using them fails on type resolution, a symptom distinct from getv/setv errors. [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md) [slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)

`GradInOutTensor.primal` accessor is also gone; migrate `t.primal.shape[0]` → `t.shape[0]` (RWDiffTensor exposes `shape` directly) or `t._primal.shape[0]`. The new struct fields are `_primal` (Tensor) and `_grad_out` (AtomicTensor). [Migrating Slang code to slangpy 0.41 Tensor API — implementation gotchas + GPU-less compile-check](../learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md)

### 3. NDBuffer Removal
`NDBuffer`/`RWNDBuffer` are completely removed from the Slang runtime API (not just deprecated). Migration path: function param `NDBuffer` → `ITensor`, `RWNDBuffer` → `IRWTensor`; variable `NDBuffer` → `Tensor`. Python `spy.NDBuffer` is entirely gone from current main — no symbol, no `__getattr__` shim, no native binding (changelog: removal under PR #697). [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md) [slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)

### 4. Field Accessor Renames on Diff Types
Old `.d_out` → `_grad_out`, old `.primal` → `_primal` on the new differentiable types. [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md)

## The Store-vs-Add Rule

This is the key correctness nuance — both `store` and `add` compile without error; getting it wrong silently corrupts results.

**The precise rule:** map `get`/`set`/`getv`/`setv` → `load`/`store` uniformly. Use `add` ONLY at hand-written-backward sites that scatter gradients into an `AtomicTensor` (or a differentiable tensor's `_grad_out` field). [slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified) — add preserves behavior, not changes it](../learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md)

**Why `set→add` is safe at AtomicTensor sites:** old slangpy `set` on an `AtomicTensor` was already an atomic accumulate under the hood. So `set→add` at gradient-scatter sites PRESERVES the original behavior — it is not introducing new accumulation. [slangpy 0.41 migration: old set() on AtomicTensor ACCUMULATED (set→add preserves, not changes)](../learnings/1781608830888-slangpy-0-41-migration-old-set-on-atomictensor-acc.md)

**The trap:** a plain `RWTensor` read-modify-write (e.g. `x.set(p, x.get(p)+g)` or an averaging `x.set(p, x.get(p)/N)`) must become `store(load(p)…)`, NOT `add`. Turning a `/N` average into `add` corrupts the result. [slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified) — add preserves behavior, not changes it](../learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md) [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md)

**Shortcut:** if you use `DiffTensor`/`RWDiffTensor` and let autodiff generate the backward, gradient accumulation is automatic — user code only ever calls `load`/`store`. `add` is purely a manual-written-backward concern. [slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified) — add preserves behavior, not changes it](../learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md)

**Authoritative reference migration:** `shader-slang/neural-shading-s25#10` (MERGED 2026-05-04): `texture_grads`/`biases_grad`/`weights_grad` (all `AtomicTensor`) → `add`; plain training grads (`RWTensor`) → `store`. DeepWiki's generic answer that old `set` overwrote even on atomic/gradient tensors is WRONG — don't trust it. [slangpy 0.41 migration: old set() on AtomicTensor ACCUMULATED (set→add preserves, not changes)](../learnings/1781608830888-slangpy-0-41-migration-old-set-on-atomictensor-acc.md)

## Implementation Gotchas

**Braced-initializer-list indices fail for 2-D+.** The new generic `load<I>/store<I>/add<I>` overloads do NOT infer the element type `I` from a braced list for 2-D/3-D: `t.load({a, b})` → `error[E39999]: not enough arguments`. Use explicit vectors: `t.load(int2(a,b))`, `g.add(int3(y,x,idx), v)`. 1-D `{a}` still resolves; multi-arg subscript `t[y,x,idx]` still works fine. [Migrating Slang code to slangpy 0.41 Tensor API — implementation gotchas + GPU-less compile-check](../learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md)

**GPU-less compile validation.** A standalone `slangc` matching the bundled Slang version can front-end/semantic-check each `.slang` against the slangpy slang include path without a device:
`slangc <file> -I <SHADER_PATH> -I <file-dir> -target spirv -o /dev/null`
The only expected error for functional-API shaders (no `[shader]` entry point) is the benign `error[E57004]: SPIR-V output contains no exported symbols` — treat that as PASS. This catches every accessor/type migration error (`E30027 member not found`, `E30015 undefined identifier`). It does NOT catch store-vs-add (both compile). [Migrating Slang code to slangpy 0.41 Tensor API — implementation gotchas + GPU-less compile-check](../learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md) Refinements: compile the MODULE ROOT (the file with `module X;` + `__include`s), not an `implementing X;` fragment, with two `-I` paths (the shipped slangpy slang dir + the module's own dir); the cleanest error isolation **omits `-target` entirely** (pure front-end, exits 0 on clean code), whereas `-target spirv -o /dev/null` also emits ~137 harmless `E30856`/`E31159` library-noise warnings to filter and `-target hlsl` fails with a benign `E00070` CLI artifact (needs `-entry`). Accessor facts for `DiffTensor<T,D>`: it exposes public `_primal` and `_grad_out` (both with public `_data`), and `AtomicTensor.add` has both an array `add<I>(I idx[D], T)` and a vector `add<I>(vector<I,D> idx, T)` overload, so `{row}` and `int2(row,col)` both type-check ([GPU-less front-end validation of SlangPy Tensor-API migrations with slangc](../learnings/1783524125786-gpu-less-front-end-validation-of-slangpy-tensor-ap.md)).

**`import neural;` requires `enable_experimental_features`.** `slangpy.create_device()` hardcodes `compiler_options` to `{include_paths: [...]}` and has NO parameter to enable experimental features. Use `spy.Device(...)` directly with `compiler_options={"enable_experimental_features": True, "include_paths": [spy.SHADER_PATH, <your dir>]}`. [slangpy API churn: getv/setv→load/store/add rename + create_device has no experimental-features passthrough (neural module gate)](../learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md)

**Coop-vec migration gap.** The reference migration PR `neural-shading-s25#10` only migrated `network/*` + `mipmap/*` — none use coop-vec. Whether `coopVecMatMulAdd`/`coopVecOuterProductAccumulate`/etc. accept the new `_data` buffer types (StructuredBuffer / atomic RWByteAddressBuffer) is UNVERIFIED and needs coop-vec-capable hardware to settle. Treat coop-vec migrations as blocked-on-HW, not mechanical search-replace. [slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)

## Internal Data Model

`DiffTensor<T,D>` = `Tensor<T,D> _primal` + `AtomicTensor<T.Differential,D> _grad_out`. `Tensor._data` is `StructuredBuffer<T>` or `T*` (core.slang:82-86). `AtomicTensor._data` is `RWByteAddressBuffer` or `T*` — the grad_out buffer is ATOMIC, not plain RW. [slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)

## Functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt

For slangpy#808 (CUDA RWTexture/surface writes don't float→normalized-int convert): the slangpy functional-API generated accessor carries **no `[format(...)]` decoration**, so even post-fix CUDA UNORM writes corrupt — the missing format decoration is answerable by inspecting the generated accessor ([1781016372307-slangpy-functional-api-textures-emit-n](../learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md)).

## Neural-Module 0.41 Migration Depends on the slang-side Differentiable Subscript (#12026)

When porting neural demos to the current neural-module API (context: slangpy-samples#51), the 0.41 API drops the old `extern struct IVector` + `bit_cast` differentiation WARs and reads/writes vector elements directly via a `[Differentiable] operator[]`. That differentiable subscript is added by **shader-slang/slang#12026**, which puts the `[Differentiable] get/set __subscript` *requirement on the IVector interface* — so because `FFLayer.eval` is generic over `IVector`, the dependency gates the **InlineVector (default) variant too**, not only the wave variant (verify against the interface requirement, not the concrete type — PR bodies mis-claim wave-only). See the slang-side treatment in [Differentiable subscript requirement lives on IVector (#12025/#12026)](../concepts/slang-autodiff-ir-autodiff-differentiation.md). Related migration facts: slang#10195 (`getOffset` not differentiable) is CLOSED, so inline `params.getOffset(...)` inside `[Differentiable]` fns no longer needs a WAR; changing gradient accumulation from `.set({...})` to `.add(...)` on `AtomicTensor<T,3>` (which has a generated positional `add(int,int,int,T)`) is a real *correctness* fix (atomic accumulation across bilinear taps / batch threads), not an API rename; and `Tensor<T,D>` `getv(int2)` and `tensor[int2]` both funnel to the same `load(indices)` path, so renaming `getv`→subscript introduces no transpose. CI caveat: slangpy-samples CI is only `pre-commit.yml` + issue-sync, and `tests/examples/test_examples.py` enumerates examples EXPLICITLY, so a new example gets zero CI unless you add a `test_*` entry; and repo-wide black drift can red a PR on files it doesn't touch ([slangpy neural-module 0.41 migration: differentiable vector operator[] gates inline too (slang#12026)](../learnings/1783620159628-slangpy-neural-module-0-41-migration-differentiabl.md)).

---
**Source learnings (11):**
- [slangpy neural-module 0.41 migration: differentiable vector operator[] gates inline too (slang#12026)](../learnings/1783620159628-slangpy-neural-module-0-41-migration-differentiabl.md)
- [slangpy API churn: getv/setv→load/store/add rename + create_device has no experimental-features passthrough](../learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md)
- [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md)
- [slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)
- [Migrating Slang code to slangpy 0.41 Tensor API — implementation gotchas + GPU-less compile-check](../learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md)
- [slangpy 0.41 migration: old set() on AtomicTensor ACCUMULATED (set→add preserves, not changes)](../learnings/1781608830888-slangpy-0-41-migration-old-set-on-atomictensor-acc.md)
- [slangpy-samples CI pre-commit runs --all-files; a single un-newlined file reds every PR](../learnings/1781609083456-slangpy-samples-ci-pre-commit-runs-all-files-a-sin.md)
- [slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified)](../learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md)
- [slangpy functional-API textures emit no [format] decoration → CUDA UNORM writes corrupt even post-fix (#808)](../learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md)
- [GPU-less front-end validation of SlangPy Tensor-API migrations with slangc](../learnings/1783524125786-gpu-less-front-end-validation-of-slangpy-tensor-ap.md)
_Catalog: [[wiki/index.md]]_
