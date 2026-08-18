---
title: "slangpy API churn: getv/setv→load/store/add rename + create_device has no experimental-features passthrough (neural module gate)"
type: learning
topic: slang-compiler
source: learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md
---

# slangpy API churn: getv/setv→load/store/add rename + create_device has no experimental-features passthrough (neural module gate)

# slangpy API churn that breaks slangpy-samples (triage of slangpy-samples#43)

Two durable, reusable facts discovered while triaging "samples broken with newest slangpy":

## 1. Slang Tensor element accessors were renamed: `getv`/`setv` → `load`/`store`/`add`
- Old slangpy Slang-side Tensor API: `t.getv(idx)`, `t.setv(idx, v)`.
- New API (current `slangpy/slang/tensor_indices_each.slang`, `tensor_indices_generated.slang`): `t.load(idx)`, `t.store(idx, v)`, `t.add(idx, v)`. No `getv`/`setv` remain.
- Migration: `getv`→`load`; `setv`→`store` for plain overwrite **or** `add` for accumulation.
- **Why it matters / gotcha:** store-vs-add is SEMANTIC, not a mechanical rename. Differentiable backward passes and scatter/splatting kernels accumulate — those `setv` sites must become `add`, not `store`. A blind `setv→store` compiles fine but silently drops contributions (wrong gradients/results, no error). Reference migration PR: shader-slang/neural-shading-s25#10.

## 2. `import neural;` requires `enable_experimental_features` — and `slangpy.create_device()` can't set it
- A "can't find neural.slang" error from a sample doing `import neural;` is NOT a missing file. `neural` is a Slang **experimental** module gated behind the compiler option `enable_experimental_features=true`.
- The flag lives on `SlangCompilerOptions` (`src/sgl/device/shader.h:195`, C++ comment literally "required for neural module"); sgl maps it to `slang::CompilerOptionName::ExperimentalFeature` (`src/sgl/device/shader.cpp:344`); exposed to Python via `DeviceDesc.compiler_options` (`src/slangpy_ext/device/device.cpp`).
- **Gotcha:** the convenience wrapper `slangpy.create_device()` (`slangpy/core/utils.py:52-57`) HARDCODES `compiler_options` to `{include_paths: [...]}` — there is NO parameter to enable experimental features. To enable it you must construct `spy.Device(...)` directly with `compiler_options={"enable_experimental_features": True, "include_paths": [spy.SHADER_PATH, <your dir>]}` (the create_device docstring endorses this "for full control"). `slangpy.SHADER_PATH` is exported (`slangpy/__init__.py:69`).

## Triage context
slangpy-samples pins no Slang and runs against whatever installed `slangpy` provides; check version with `python -c "import slangpy; print(slangpy.SLANG_BUILD_TAG)"`. When samples "break on the newest slangpy", suspect API renames like #1 first, then compiler-option gates like #2.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781601865188-slangpy-api-churn-getv-setv-load-store-add-rename-.md`_
