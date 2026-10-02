---
name: project_slangpy_222_amd_atomic_grad_scatter
description: "slangpy#222 AD grads wrong on AMD RDNA2 iGPU — two distinct bugs: Vulkan [72,0,0,0] = slang-rhi mis-advertises float-atomic-add (slang-rhi#833, fix PR #834); D3D12 [0,0,0,0] = Slang emits NVAPI-only InterlockedAddF32 silently (slang#12505, held for maintainer). #222 stays open until both land + pin bump."
metadata:
  node_type: memory
  type: project
  originSessionId: 912fa049-6a1e-444e-b3bf-74494c573359
---

**shader-slang/slangpy#222** — "AD doesn't work, gradients are always 0" (external reporter, 2025-05-19; OPEN; `autodiff`; milestone Q4 2026; no assignee). Canonical thread `gh-issue-shader-slang/slangpy-222`; slangpy-triager owns #222 replies, slang-triager owns the upstream slang / slang-rhi legs. MEMBER swoods-nv has the AMD RDNA2 iGPU and supplied the decisive data. **State re-checked 2026-10-01: #222, slang-rhi#833, slang-rhi#834, slang#12505 and slangpy#1102 all still OPEN, untouched since 2026-08-18.**

## What actually goes wrong

The title is wrong: grads are **computed** but **written to the wrong place**. Docs `polynomial` example (`2x²+8x−1`, x=[1,2,3,4]) should give `4x+8` = `[12,16,20,24]`. On the RDNA2 iGPU, **Vulkan → `[72,0,0,0]`** (all four collapsed into element 0) and **D3D12 → `[0,0,0,0]`** (dropped). Discrete AMD 9070 XT (RDNA4)/Linux gives the correct answer, so it is device-scoped, not all-AMD.

Scatter path (slangpy `main` 184fb2f): `_grad_out.add(idx,grad)` in `_load_bwd` (`slangpy/slang/difftensor.slang:142,146,530,536`) → `atomicAddWithStride` → non-CUDA `T::atomicAdd(buffer, idx*byte_stride, value)` (`atomics.slang:113/116`) → `buf.InterlockedAddF32(addr, value)` with a byte address (`:34-37`). Only `half2` carries `[__requiresNVAPI]` (`:57`). Unchanged since `842f6a93` (2025-05-02); not silently fixed.

## Vulkan arm — slang-rhi capability mis-advertisement (slang-rhi#833 / PR #834)

Slang has **no CAS fallback** for float atomic-add: `ensureAtomicCapability` (`slang-emit-spirv.cpp`) unconditionally requires `SPV_EXT_shader_atomic_float_add`, and Slang errors at compile time if it is absent. The device reports `shaderBufferFloat32Atomics = true` but `shaderBufferFloat32AtomicAdd = false`. slang-rhi `src/vulkan/vk-device.cpp:822-830` instantiates `SIMPLE_EXTENSION_FEATURE(atomicFloatFeatures, shaderBufferFloat32Atomics, …)` and pushes `Capability::SPV_EXT_shader_atomic_float_add` off the **base** bit, so the compiler is told add is supported; the driver then runs an unsupported `OpAtomicFAddEXT`. The float16 sibling at `:832-841` has the same conflation; no `*AtomicAdd` bit is read anywhere in slang-rhi.

The fix subtlety: the macro's gate bit does double duty — it chains the extension feature struct into device-create **and** guards the capability push. Swapping the gate to the add bit would break base float atomics on add-less devices. The correct fix keeps the base bit for extension-enable and guards **only** the capability push behind the `*AtomicAdd` bits. PR #834 (draft) does exactly that, float16 sibling included; slang-triager re-verified it against `vulkan_core.h`. Awaiting slang-reviewer + CI + maintainer.

## D3D12 arm — Slang emits NVIDIA-only intrinsic silently (slang#12505)

The atomic is not produced by the autodiff pass (`slang-ir-autodiff*.cpp` has 0 atomic hits; it aggregates with scalar `dadd`, `slang-ir-autodiff.cpp:646`). It comes from the tensor wrapper's hand-written `[BackwardDerivative]` in `diff.meta.slang:855-860,986`, which autodiff differentiates through — so a fixer sent to the autodiff pass finds nothing. `InterlockedAddF32` (`hlsl.meta.slang:6536/:6681`) is `[__requiresNVAPI]` and emits `NvInterlockedAddFp32`; `slangc -target hlsl` emits it with rc=0 and no diagnostic, while the generic float `InterlockedAdd` path does hard-error E55204. Fix options on the issue: (A) diagnose instead of silent NVAPI emit, (B) non-NVAPI CAS-loop emulation via 32-bit `InterlockedCompareExchange` (`hlsl.meta.slang:6962`), (C) capability-driven A+B.

**Main decision 2026-08-12: hold #12505 for a maintainer to pick A vs B/C; no slang-fixer dispatch.** A-vs-B is a scope call on sensitive core-module emit, and the precedent [[project_slangpy_1051_slang_12070_autodiff_runtime_loop_start]] saw a maintainer supersede our draft with a broader PR.

## Resume triggers and closure gate

- **slang-rhi#834 merges** → slang-triager re-reads the merged diff and reports; then **Main** finds how slangpy pins slang-rhi (may differ from the `external/CMakeLists.txt` `SGL_SLANG_VERSION` tarball pin) and drives the bump.
- **Maintainer picks a direction on #12505** (ping, assignment, or comment) → re-evaluate dispatching slang-fixer on that approach. slang-triager holds the watch on thread `…/upstream-slang-d3d-autodiff` (its memo: `triage-slangpy-222-d3d-arm.md` in its own container).
- **#222 closes** only after both arms land and reach slangpy.
- Spin-off docs fix **slangpy#1102** (`docs/src/tensors/differentiable.rst:72` forward comment `[9.,27.,53.,87.]` → `[9.,23.,41.,63.]`; no `Fixes #222`) is human-APPROVED by jkiviluoto-nv but still draft; the only gate is a human promote + merge (the fixer does not self-undraft).

## Lessons

- **A webhook body is a snapshot at creation.** swoods-nv edited comment 5258887595 from "both Windows and Linux" to "both Vulkan and D3D"; an inference built on the creation text ("OS axis drops out") had to be retracted. Re-fetch before recording a claim; `updated_at > created_at` is the tell.
- **A compile-time SPIR-V capability is not a runtime device feature.** Our on-issue claim "you got numbers, so the capability was present on your device" was a non-sequitur: the profile carried the capability only because slang-rhi mis-advertised it. The acknowledgment (comment 5269272577) issued the correction and credited swoods-nv.
- A reporter's localization can be right in spirit and wrong at the producer (claim "autodiff generates `kIROp_AtomicAdd`"); verify against source before routing a fixer to a file.

Siblings (different bug class — compiler autodiff-transpose, not atomic scatter): [[project_slangpy_1051_slang_12070_autodiff_runtime_loop_start]], [[project_slangpy_1055_diff_loop_vector_return_wrong_grads]].
