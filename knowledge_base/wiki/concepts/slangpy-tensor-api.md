---
title: "SlangPy Tensor API (0.41+ Migration)"
type: concept
group: slangpy
tags: [slangpy, tensor, migration, autodiff, ndarray, api-churn, link-time-constants, neural-shading-s26]
source_count: 22
---

# SlangPy Tensor API (0.41+ Migration)

The SlangPy 0.41 release rewrote the Slang-side Tensor API: it removed the legacy accessor names, renamed the differentiable tensor types, and eliminated `NDBuffer`. A migration needs the four breakage classes below plus one precise store-vs-add rule. The page also covers the Tensor internals, the tensor-array / D3D12 clear cluster, link-time constants, and host readback layout.

## TL;DR

- **Read `slangpy/docs/tensorupdate.rst` first**, and check `shader-slang/neural-shading-s26` before migrating any s25-era sample — the s25 / slangpy-samples work is superseded.
- **Map `get`/`set`/`getv`/`setv` → `load`/`store` uniformly; use `add` only at hand-written-backward sites that scatter gradients into an `AtomicTensor`** (or a diff tensor's `_grad_out`). Both compile, so a wrong choice silently corrupts results.
- **`set`→`add` at AtomicTensor sites preserves behavior** — old `set` on an `AtomicTensor` already accumulated atomically. DeepWiki's claim that it overwrote is wrong.
- **A plain `RWTensor` read-modify-write becomes `store(load(...))`, never `add`** — an averaging `x.set(p, x.get(p)/N)` turned into `add` is wrong.
- **With `DiffTensor`/`RWDiffTensor` and autodiff-generated backward, user code only calls `load`/`store`.** `add` is a manual-backward concern.
- **`Grad*Tensor` names are removed:** `GradInTensor`→`WDiffTensor`, `GradOutTensor`→`DiffTensor`, `GradInOutTensor`→`RWDiffTensor` (interfaces `IWDiffTensor`/`IDiffTensor`/`IRWDiffTensor`); the symptom is a type-resolution error.
- **Diff-type fields:** `.primal`→`_primal`, `.d_out`→`_grad_out`; `t.primal.shape[0]` → `t.shape[0]`.
- **`NDBuffer`/`RWNDBuffer` are gone:** param → `ITensor`/`IRWTensor`, variable → `Tensor`. Python `spy.NDBuffer` has no symbol, shim, or binding.
- **Braced indices do not infer the type for 2-D+:** `t.load({a,b})` gives E39999; use `int2(a,b)` / `int3(...)`. 1-D `{a}` and `t[y,x,idx]` still work.
- **Validate GPU-free with `slangc` on the MODULE ROOT** (`module X;` + `__include`s) with `-I` for the slangpy slang dir and the module dir, and no `-target` (exits 0 when clean). It catches accessor/type errors, never store-vs-add.
- **`import neural;` needs `enable_experimental_features`; `create_device()` cannot pass it** — use `spy.Device(...)` with explicit `compiler_options`.
- **Coop-vec migrations are blocked on hardware**, not search-replace: the reference migration never touched coop-vec.
- **Host-computed constants (arrays too) are link-time constants** — `extern static const` + a linked `export static const` module. `func.constants()` rejects lists.
- **`DiffTensor<T,D>` = `Tensor _primal` + `AtomicTensor _grad_out`;** `AtomicTensor._data` is `RWByteAddressBuffer`/`T*` (atomic). No public named raw-buffer accessor exists; `read_buffer(idx)` returns one element.
- **A read-only ARRAY-of-Tensor param needs elements created `usage=shader_resource`** — element types compare by full_name string (`RWTensor` ≠ `Tensor`). Scalars adopt the param's access, so the rule is asymmetric.
- **`Tensor.zeros`/`zeros_like`/`with_grads` clear via `Tensor::clear()`;** D3D12 `clear_buffer` needs a UAV and removes the device on a `shader_resource`-only buffer. Fix at `Tensor::clear()`, never by adding the UAV bit; the copy-path divert is safe only for `device_local` storage.
- **`with_grads(grad_in=...)` needs a writable primal.**
- **Functional-API texture accessors carry no `[format(...)]`**, so CUDA UNORM writes corrupt even after a backend fix.
- **A slangpy-samples example gets zero CI without a `test_*` entry,** and repo-wide pre-commit drift can red unrelated PRs.
- **`to_ndarray` exposes a struct innermost dtype as `uint8` bytes;** #1222 scales strides for packed layouts, but padded nested layouts (#163 B, CUDA `half3[2]`) still read padding.
- **Struct padding is per-target** (WGSL ignores forced scalar layout; CUDA `half3` is 4-aligned). Trust reflection.
- **Verify current-source facts only** — the standard checkout is a shallow clone.

## Official guide and the s26 supersession

The authoritative recipe ships in the repository: `slangpy/docs/tensorupdate.rst` ("Migration guide for Tensor update"). Read it first for any slangpy-samples breakage ([slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md)).

Before any SlangPy-API migration in `slangpy-samples` or the s25 neural-shading samples, check `shader-slang/neural-shading-s26`. A maintainer said the samples "should be in shader-slang/neural-shading-s26 with the new API already", and slangpy-samples#43 was closed in favor of s26, which left our PR #46 (Fixes #43) orphaned. Follow-on work (#45 coop-vec / PR #50) may be moot for the same reason ([slangpy-samples / neural-shading-s25 superseded by neural-shading-s26](../learnings/1790878871272-slangpy-samples-neural-shading-s25-superseded-by-n.md)).

## The four breakage classes

1. **Accessor renames.** `.get(`/`.set(`/`.getv(`/`.setv(` → `.load(`/`.store(`/`.add(`. The rename looks uniform but `add` and `store` differ in meaning — see the next section ([slangpy API churn: getv/setv→load/store/add rename + create_device has no experimental-features passthrough](../learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md)).
2. **Differentiable type renames.** `GradInTensor`→`WDiffTensor`, `GradOutTensor`→`DiffTensor`, `GradInOutTensor`→`RWDiffTensor`; parameter interfaces `IWDiffTensor`/`IDiffTensor`/`IRWDiffTensor`. The old names are removed, so the failure is a type-resolution error, distinct from a getv/setv member error ([slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)).
3. **Field renames on diff types.** `.primal`→`_primal` (a `Tensor`), `.d_out`→`_grad_out` (an `AtomicTensor`). Migrate `t.primal.shape[0]` to `t.shape[0]` (RWDiffTensor exposes `shape` directly) or `t._primal.shape[0]` ([Migrating Slang code to slangpy 0.41 Tensor API — implementation gotchas + GPU-less compile-check](../learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md)).
4. **`NDBuffer` removal.** `NDBuffer`/`RWNDBuffer` are removed from the Slang runtime API: param `NDBuffer`→`ITensor`, `RWNDBuffer`→`IRWTensor`, variable `NDBuffer`→`Tensor`. Python `spy.NDBuffer` is gone from main — no symbol, no `__getattr__` shim, no native binding (changelog: PR #697).

## The store-vs-add rule

Both `store` and `add` compile, so this is the correctness trap of the migration.

**Rule:** map `get`/`set`/`getv`/`setv` → `load`/`store` uniformly. Use `add` only at hand-written-backward sites that scatter gradients into an `AtomicTensor` or a differentiable tensor's `_grad_out`. A plain `RWTensor` read-modify-write (`x.set(p, x.get(p)+g)`, or an averaging `x.set(p, x.get(p)/N)`) becomes `store(load(p)…)`, not `add`. If you use `DiffTensor`/`RWDiffTensor` and let autodiff generate the backward, accumulation is automatic and user code only calls `load`/`store` ([slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified)](../learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md)).

**Why `set`→`add` is safe at AtomicTensor sites:** old slangpy `set` on an `AtomicTensor` was already an atomic accumulate, so the change preserves behavior. The reference migration `shader-slang/neural-shading-s25#10` maps `texture_grads`/`biases_grad`/`weights_grad` (all `AtomicTensor`) → `add` and plain training grads (`RWTensor`) → `store`. DeepWiki's generic answer that old `set` overwrote even on atomic tensors is wrong ([slangpy 0.41 migration: old set() on AtomicTensor ACCUMULATED](../learnings/1781608830888-slangpy-0-41-migration-old-set-on-atomictensor-acc.md)).

## Implementation gotchas

**Braced-initializer indices fail for 2-D+.** The generic `load<I>/store<I>/add<I>` overloads do not infer `I` from a braced list for 2-D/3-D: `t.load({a, b})` gives `error[E39999]: not enough arguments`. Use `t.load(int2(a,b))`, `g.add(int3(y,x,idx), v)`. 1-D `{a}` resolves and multi-arg subscript `t[y,x,idx]` works ([Migrating Slang code to slangpy 0.41 Tensor API](../learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md)).

**GPU-less compile validation.** A standalone `slangc` matching the bundled Slang version semantic-checks each shader against the slangpy include path without a device. It catches every accessor/type error (`E30027` member not found, `E30015` undefined identifier) but not store-vs-add. Compile the MODULE ROOT (the file with `module X;` + `__include`s), not an `implementing X;` fragment, with two `-I` paths (the shipped slangpy slang dir and the module's own dir). Omitting `-target` gives the cleanest isolation (pure front end, exit 0 when clean). `-target spirv -o /dev/null` also prints ~137 harmless `E30856`/`E31159` library warnings and, for functional-API shaders with no `[shader]` entry point, `error[E57004]: SPIR-V output contains no exported symbols` (treat as PASS); `-target hlsl` fails with a benign `E00070` (needs `-entry`). `DiffTensor<T,D>` exposes public `_primal` and `_grad_out` (both with public `_data`), and `AtomicTensor.add` has both an array `add<I>(I idx[D], T)` and a vector `add<I>(vector<I,D>, T)` overload, so `{row}` and `int2(row,col)` both type-check ([GPU-less front-end validation of SlangPy Tensor-API migrations with slangc](../learnings/1783524125786-gpu-less-front-end-validation-of-slangpy-tensor-ap.md)).

**`import neural;` requires `enable_experimental_features`.** `slangpy.create_device()` hardcodes `compiler_options` to `{include_paths: [...]}` with no passthrough. Use `spy.Device(...)` with `compiler_options={"enable_experimental_features": True, "include_paths": [spy.SHADER_PATH, <your dir>]}` ([slangpy API churn: create_device has no experimental-features passthrough](../learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md)).

**Coop-vec gap.** The reference migration `neural-shading-s25#10` covered only `network/*` + `mipmap/*`, none of which use coop-vec. Whether `coopVecMatMulAdd`/`coopVecOuterProductAccumulate` accept the new `_data` buffer types (StructuredBuffer / atomic RWByteAddressBuffer) is unverified and needs coop-vec hardware ([slangpy 0.41 Tensor migration: coop-vec reference gap](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)).

## Internal data model and the missing buffer accessor

`DiffTensor<T,D>` = `Tensor<T,D> _primal` + `AtomicTensor<T.Differential,D> _grad_out`. `Tensor._data` is `StructuredBuffer<T>` or `T*` (core.slang:82-86); `AtomicTensor._data` is `RWByteAddressBuffer` or `T*`, so the grad_out buffer is atomic, not plain RW ([slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed on main](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md)).

As of 0.43.0 the Slang side (`import slangpy;`) has no public *named* accessor returning the buffer object that `coopVec*` intrinsics need — only the underscore fields, declared `public` but internal by convention. `Tensor.read_buffer(idx)` looks like one but returns a single element `T`; `load()`, `[]`, and `shape` do not help. Any "expose an accessor" proposal leaks a target-dependent representation: forward is read-only `StructuredBuffer<T>`, backward is atomic `RWByteAddressBuffer` on non-CUDA (pre-0.41 `.primal.buffer`/`.d_out.buffer` were removed in the rewrite). Verify current-source facts only — the standard checkout is a shallow clone with no old-revision history ([SlangPy Slang-side Tensor has no public raw-buffer accessor (0.43.0)](../learnings/1784757017182-slangpy-slang-side-tensor-has-no-public-raw-buffer.md)).

## Functional-API textures emit no `[format]` decoration

For slangpy#808 (CUDA RWTexture/surface writes do not convert float→normalized int): the functional-API generated accessor carries no `[format(...)]` decoration, so CUDA UNORM writes still corrupt after a backend fix. Inspect the generated accessor to confirm ([slangpy functional-API textures emit no [format] decoration](../learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md)).

## Neural-module 0.41 migration depends on slang#12026

Porting neural demos to the current neural-module API (slangpy-samples#51) drops the old `extern struct IVector` + `bit_cast` WARs and reads/writes vector elements through a `[Differentiable] operator[]`. shader-slang/slang#12026 adds that subscript as a requirement *on the IVector interface*, and `FFLayer.eval` is generic over `IVector`, so the dependency gates the InlineVector (default) variant too, not only the wave variant — check the interface requirement, since PR bodies mis-claim wave-only. See [Differentiable subscript requirement lives on IVector](../concepts/slang-autodiff-ir-autodiff-differentiation.md). Related facts: slang#10195 (`getOffset` not differentiable) is closed, so inline `params.getOffset(...)` in `[Differentiable]` functions needs no WAR; `.set({...})`→`.add(...)` on `AtomicTensor<T,3>` (which has a generated positional `add(int,int,int,T)`) is a correctness fix (atomic accumulation across bilinear taps / batch threads), not a rename; and `getv(int2)` and `tensor[int2]` both reach the same `load(indices)`, so the rename introduces no transpose ([slangpy neural-module 0.41 migration: differentiable vector operator[] gates inline too (slang#12026)](../learnings/1783620159628-slangpy-neural-module-0-41-migration-differentiabl.md)).

slangpy-samples CI is only `pre-commit.yml` + issue-sync, and `tests/examples/test_examples.py` enumerates examples explicitly, so a new example gets zero CI without a `test_*` entry. Pre-commit runs `--all-files`, so repo-wide black drift — even one file without a trailing newline — reds every PR, including ones that do not touch it ([slangpy-samples CI pre-commit runs --all-files; a single un-newlined file reds every PR](../learnings/1781609083456-slangpy-samples-ci-pre-commit-runs-all-files-a-sin.md)).

## Tensor arrays and the D3D12 clear device-loss (#1079/#1080)

**Usage flag.** A read-only `Tensor` array param (`Tensor<float,1> tensors[4]`) requires each element to be created `usage=BufferUsage.shader_resource` (no UAV). The array resolver compares element types by **full_name string**, and a default-UAV tensor stringifies to `RWTensor<...>` ≠ `Tensor<...>`, so resolution fails on all backends. The scalar path instead adopts the parameter's access (`tensorcommon.py`), so "drop the shader_resource override to match other tests" is right for scalars and breaks arrays ([Tensor usage flag (shader_resource vs UAV) is load-bearing for ARRAY-of-Tensor params](../learnings/1785359040591-slangpy-tensor-usage-flag-shader-resource-vs-uav-i.md)).

**Device loss.** A `shader_resource`-only tensor then hits D3D12 device loss: `Tensor.zeros`/`zeros_like`/`with_grads` all route through `Tensor::clear()` → `clear_buffer`, and D3D12 `clear_buffer` creates a UAV (`ClearUnorderedAccessViewUint`) that fails on a non-UAV buffer → `RemoveDevice`, poisoning the shared device. Vulkan/CUDA clear via transfer ops and pass silently ([Tensor.zeros clears unconditionally — D3D12 device loss on shader_resource-only tensors](../learnings/1785359276875-slangpy-tensor-zeros-clears-unconditionally-d3d12-.md)).

**`with_grads`.** `with_grads(grad_in=...)` requires a writable primal, so a DiffTensor READ test uses `grad_out` only and an RWDiffTensor WRITE test needs both. Read the reviewer's wording precisely (szihs named the WRITE test) ([Tensor.with_grads: grad_in only valid for writable primal](../learnings/1785354955971-slangpy-tensor-with-grads-grad-in-only-valid-for-w.md)).

**Fix.** PR #1080 roots the fix at `Tensor::clear()`, not `tensor_zeros`, because it is the single choke point for all three paths (including `zeros_like` grad clears). It diverts non-UAV clears to a host-upload copy path (`copy_destination`, no UAV). Adding the UAV bit is wrong: it renames `Tensor`→`RWTensor` and breaks the string-compare resolution ([#1079 Defect 2 fix: root-cause at Tensor::clear(), not tensor_zeros](../learnings/1785363716295-slangpy-1079-defect-2-fix-root-cause-at-tensor-cle.md)). The copy path is safe on the default path (`copy_destination` is injected for `device_local` storage regardless of usage), but the UAV requirement is D3D12-specific: a uniform divert can regress a non-`device_local` `read_back` tensor (`set_data` throws there) where CUDA/Metal previously succeeded. Verify each backend's clear primitive ([#1080 Tensor::clear copy-path: copy_destination guaranteed only for device_local](../learnings/1785365827665-slangpy-1080-tensor-clear-copy-path-copy-destinati.md)).

**Repro.** The four `test_array_of_*` tests exist only on PR #1078's head, not on main or the CI checkout branch — branch off #1078. The stale Metal skips cite closed slang#7606 ([slangpy#1079 repro tests live only in PR #1078, not on main/CI branch](../learnings/1785359638612-slangpy-1079-repro-tests-live-only-in-pr-1078-not-.md)).

## Host-supplied compile-time constants are link-time constants

When the host must compute constants before compilation (slang#13392: coop-vec weight/bias offsets), use **link-time constants**; arrays work. The shader declares `extern static const int kOffs[2];`, the host builds a second module with `export static const int kOffs[2] = {0,4096};` (`ISession::loadModuleFromSourceString`), and links them (`createCompositeComponentType`). On master 1740f5a81, `replaceGlobalConstants` (`slang-ir-link.cpp:2729`, run at `slang-emit.cpp:1102`) substitutes the values, so `OpCooperativeVectorMatrixMulAddNV` gets `%int_4096` OpConstant operands even at `-O0`, HLSL and CUDA emit `int(4096)`, and link-time scalars and array elements satisfy `constexpr` params such as `matrixStride`.

Limits: a link-time array element cannot appear in a type position (`CoopVec<half, kDims[0]>` gives E39999, a front-end TODO at `slang-check-expr.cpp:3296-3302`; a scalar extern works), and specialization constants are scalar/enum only (arrays give E31218). In slangpy, `spy.Module.load_from_source(device, name, src, link=[device.load_module_from_source(...)])` resolves externs, while `func.constants({...})` emits `export static const` only for bool/int/float/vector and raises on lists (`generator.py:110-126`). Coop-vec offsets are plain runtime `int32_t` (`hlsl.meta.slang:34146`), so baking them in is an optimization, not a requirement ([host-computed compile-time constants (incl. arrays) = link-time constants; slangpy .constants() rejects arrays](../learnings/1790935127398-host-computed-compile-time-constants-incl-arrays-l.md)).

## Host readback layout: `to_ndarray` strides and per-target padding (slangpy#163)

`Tensor.to_numpy` and `Tensor.to_torch` share `to_ndarray()` in `src/slangpy_ext/func/tensor.cpp:72-106`. For a struct innermost dtype it exposes the element as raw `uint8` bytes: `innermost_size = 1` plus a trailing byte dimension. The dtype-dimension strides come from `dtype->shape().calc_contiguous_strides()`, which counts innermost *elements*, so they must be multiplied by `innermost_layout->stride() / innermost_size` (1 for scalars). Before slangpy#1222 they were unscaled: `RGB[2]` (12-byte struct) gave `(24,1,1)` instead of `(24,12,1)`. #1222 fixes the packed case. The second half of #163 is open pending a maintainer decision: `to_ndarray` never reads the reflected nested strides, so a padded nested layout reads padding as data ([to_ndarray: struct innermost exposed as uint8, dtype-dim strides must be scaled](../learnings/1792033380879-slangpy-to-ndarray-struct-innermost-exposed-as-uin.md)).

Which targets pad: SGL forces `GLSLForceScalarLayout` (`src/sgl/device/shader.cpp:452`), and cpu/cuda/d3d12/metal/vulkan structured buffers pack `float3[2]` to 24 B. **WGSL ignores the forced scalar layout** — `float3[2]` is 32 B and `b` in `struct { float3 a; float3 b; }` sits at offset 16. "Size 28 / stride 32" for two `float3`s is the HLSL constant-buffer layout, not a structured-buffer one ([layout triage: WGSL ignores forced scalar layout; to_ndarray inner strides assume packed](../learnings/1792031278588-slangpy-layout-triage-wgsl-ignores-forced-scalar-l.md)). CUDA pads for another reason: Slang reflects `half3` as 8 B (`__align__(4)`), so `half3[2]` has stride 16 while Vulkan and CPU pack it to 12 B. On CUDA, SlangPy 0.43.1 `to_numpy`/`copy_from_numpy` return strides `(16,6,2)` and read the padding — a live #163 B case reproduced with a real dispatch on the L40S fleet; `float3[2]` is correct on cuda, vulkan and cpu. Re-run bugs that were only simulated on a GPU-less container on the real GPU, since a real repro is a stronger maintainer ping. wgpu device creation still fails in these containers, so WGSL-layout bugs are checkable only through slangc reflection ([Tensor.to_numpy misreads CUDA half3[2] padding — real-GPU repro](../learnings/1792289207603-slangpy-tensor-to-numpy-misreads-cuda-half3-2-padd.md)). Because layout is per-target, the reflected stride is the only trustworthy size — the same reason `create_buffer` needs `resource_type_layout=`, not a hand-written `struct_size` (see [SlangPy CI, Triage, Build, and Runtime](slangpy-ci-triage.md)).

Testing without a GPU:

- `DeviceType.cpu` + `pip install slangpy` in a fresh `uv venv` runs real dispatches. To emulate a padded backend on cpu, build a `slangpy.native_func.TensorDesc` with a surrogate `element_layout`, such as the `buffer_layout.reflection` of `struct Pad32 { float4 a; float4 b; }`. Before #1183, `spy.Module(...)` needs `compiler_options={"include_paths": [<slangpy>/slang]}`.
- Measure a padded type's size from the field offsets of an enclosing struct (`struct W { T t; float tail; }`); an array field's reported `size` can mislead. Write each target's `-reflection-json` to its own file — one reused `r.json` holds only the last target and misled a reviewer.
- `test_dtypes.py` skips the whole module without torch, so put a torch-free regression test in `test_tensor.py`. A full CPU `slangpy_tests` run carries ~167 pre-existing failures; diff against a base build ([SlangPy Validation Against an Unreleased Slang PR](slangpy-validation-against-unreleased-slang.md)).

**Source learnings (22):**
- [SlangPy layout triage: WGSL ignores forced scalar layout; to_numpy inner strides assume packed](../learnings/1792031278588-slangpy-layout-triage-wgsl-ignores-forced-scalar-l.md) — WGSL float3[2]=32 B; HLSL cbuffer 28/32; per-target reflection-json files
- [slangpy to_ndarray: struct innermost exposed as uint8, dtype-dim strides must be scaled](../learnings/1792033380879-slangpy-to-ndarray-struct-innermost-exposed-as-uin.md) — #1222 fixes packed case; #163 B open; torch-free test; ~167-failure baseline
- [slangpy Tensor.to_numpy misreads CUDA half3[2] — real-GPU repro](../learnings/1792289207603-slangpy-tensor-to-numpy-misreads-cuda-half3-2-padd.md) — half3[2] stride 16, 0.43.1 returns (16,6,2); re-run simulated bugs on GPU
- [slangpy neural-module 0.41 migration: differentiable operator[] gates inline too (slang#12026)](../learnings/1783620159628-slangpy-neural-module-0-41-migration-differentiabl.md) — IVector requirement; set→add is a correctness fix
- [slangpy API churn: getv/setv→load/store/add + create_device has no experimental-features passthrough](../learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md) — use spy.Device for `import neural;`
- [slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule](../learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md) — docs/tensorupdate.rst is authoritative
- [slangpy-samples / neural-shading-s25 superseded by neural-shading-s26](../learnings/1790878871272-slangpy-samples-neural-shading-s25-superseded-by-n.md) — #43 closed for s26; PR #46 orphaned
- [Host-computed compile-time constants (incl. arrays) = link-time constants](../learnings/1790935127398-host-computed-compile-time-constants-incl-arrays-l.md) — slang#13392; .constants() rejects lists; type-position E39999
- [slangpy 0.41 Tensor migration: coop-vec reference gap + Python NDBuffer fully removed](../learnings/1781606921222-slangpy-0-41-tensor-migration-coop-vec-reference-g.md) — Grad*Tensor renames; DiffTensor data model
- [Migrating Slang code to slangpy 0.41 Tensor API — gotchas + GPU-less compile-check](../learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md) — braced 2-D indices E39999; primal→_primal
- [slangpy 0.41 migration: old set() on AtomicTensor ACCUMULATED](../learnings/1781608830888-slangpy-0-41-migration-old-set-on-atomictensor-acc.md) — set→add preserves behavior; DeepWiki wrong
- [slangpy-samples CI pre-commit runs --all-files; a single un-newlined file reds every PR](../learnings/1781609083456-slangpy-samples-ci-pre-commit-runs-all-files-a-sin.md) — repo-wide drift reds unrelated PRs
- [slangpy getv/setv→load/store/add: the precise store-vs-add rule (reviewer-verified)](../learnings/1781609114268-slangpy-getv-setv-load-store-add-the-precise-store.md) — add only for manual-backward AtomicTensor scatter
- [slangpy functional-API textures emit no [format] decoration (#808)](../learnings/1781016372307-slangpy-functional-api-textures-emit-no-format-dec.md) — CUDA UNORM writes corrupt even post-fix
- [GPU-less front-end validation of SlangPy Tensor-API migrations with slangc](../learnings/1783524125786-gpu-less-front-end-validation-of-slangpy-tensor-ap.md) — module root, two -I, omit -target
- [0.43.0 Slang-side Tensor has no public named buffer accessor](../learnings/1784757017182-slangpy-slang-side-tensor-has-no-public-raw-buffer.md) — only underscore fields; read_buffer returns an element
- [#1079 array-of-Tensor read param needs element usage=shader_resource](../learnings/1785359040591-slangpy-tensor-usage-flag-shader-resource-vs-uav-i.md) — full_name compare RWTensor≠Tensor; asymmetric with scalars
- [#1079 Tensor.zeros clears unconditionally → D3D12 device loss on shader_resource-only buffer](../learnings/1785359276875-slangpy-tensor-zeros-clears-unconditionally-d3d12-.md) — Vulkan/CUDA pass via transfer ops
- [Tensor.with_grads(grad_in=...) requires a writable primal](../learnings/1785354955971-slangpy-tensor-with-grads-grad-in-only-valid-for-w.md) — READ uses grad_out only; WRITE needs both
- [#1079/#1080 fix roots at Tensor::clear(); do NOT add the UAV bit](../learnings/1785363716295-slangpy-1079-defect-2-fix-root-cause-at-tensor-cle.md) — single choke point; host-upload copy path
- [#1080 copy-path safe only for device_local; UAV-clear is D3D12-specific](../learnings/1785365827665-slangpy-1080-tensor-clear-copy-path-copy-destinati.md) — uniform divert can regress read_back tensors
- [#1079 test_array_of_* repro tests exist only on PR #1078's head](../learnings/1785359638612-slangpy-1079-repro-tests-live-only-in-pr-1078-not-.md) — branch off #1078; stale Metal skips cite closed slang#7606

_Catalog: [[wiki/index.md]]_
