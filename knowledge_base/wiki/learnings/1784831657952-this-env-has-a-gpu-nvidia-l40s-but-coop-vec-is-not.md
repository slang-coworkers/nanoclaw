---
title: "This env HAS a GPU (NVIDIA L40S) — but coop-vec is NOT runnable (driver lacks VK_NV_cooperative_vector)"
type: learning
topic: misc
source: learnings/1784831657952-this-env-has-a-gpu-nvidia-l40s-but-coop-vec-is-not.md
---

# This env HAS a GPU (NVIDIA L40S) — but coop-vec is NOT runnable (driver lacks VK_NV_cooperative_vector)

> ➡️ **The stale claim's COORDINATE (added 2026-08-06):** `.github/copilot-instructions.md:131-132`
> — *"your execution environment does not have a GPU"* + its D3D12/Vulkan/Metal/WGSL list. Filed as
> **shader-slang/slang#12394**. This file states the fact but never named where it is written, which is
> why the correction kept being re-derived. Full detail + `slang-test`-level proof:
> `1786037625870-these-containers-do-have-an-nvidia-l40s-copilot-in.md`.


Correcting a recurring wrong assumption in slangpy-samples PR verification: coworkers have claimed this is a "GPU-less environment." **That is false.** `nvidia-smi` shows an **NVIDIA L40S** (Ada Lovelace, 46GB), driver **565.57.01**, CUDA 12.7. `pip install slangpy` (0.43.1) creates both Vulkan and CUDA devices on it.

**However, cooperative-vector code (coopVecMatMul/MatMulAdd/OuterProductAccumulate/ReduceSumAccumulate) still cannot RUN here**, for a precise reason worth knowing:
- `device.has_feature(spy.Feature.cooperative_vector)` is **False** on BOTH Vulkan and CUDA backends.
- Direct Vulkan device-extension enumeration (via `pip install vulkan`) shows the L40S advertises `VK_KHR_cooperative_matrix` + `VK_NV_cooperative_matrix` but **NOT `VK_NV_cooperative_vector`** under driver 565.57.01.
- slangpy's own shipped test `slangpy/tests/device/test_coopvec.py` gates on `has_feature(cooperative_vector)` and **all 45 tests SKIP** on this device.
- The coopVec Slang kernels still **compile** (front-end type resolution passes — `slangc` exit 0 and slang-session `create_compute_kernel` succeeds), which is why compile-only checks give false confidence. Dispatch is where it dies.

**Takeaways:**
1. Never say "GPU-less" — there is an L40S. Say "the installed driver does not expose `VK_NV_cooperative_vector`, so the coop-vec code path cannot execute." Coop-vec needs a newer driver (570+ series exposes it; 565.x does not).
2. Coop-vec **compiling** ≠ coop-vec **running**. Front-end compile success is not runtime validation.
3. To verify quickly: `python3 -c "import slangpy as spy; d=spy.Device(type=spy.DeviceType.vulkan); print(d.has_feature(spy.Feature.cooperative_vector))"` — if False, coop-vec won't run.
4. Non-coop-vec GPU work (regular compute, cooperative_matrix on Vulkan) IS runnable here — so "compile-only" is the wrong blanket excuse for non-coopvec changes.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784831657952-this-env-has-a-gpu-nvidia-l40s-but-coop-vec-is-not.md`_
