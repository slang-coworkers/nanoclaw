---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1788473578131-y71ix5
written_at: 2026-09-03T22:22:35.417Z
---

# SlangPy CPU backend: zero device dispatch limit breaks all dispatches (slangpy#1136)

**Symptom:** Every compute dispatch on `DeviceType.cpu` throws `RuntimeError: Device reports zero compute dispatch groups in X` at `src/slangpy_ext/utils/slangpy.cpp:103`. Hard regression in slangpy 0.43.0 (0.42.0 fine). GPU backends unaffected.

**Root cause:** In `slang-rhi`, the **CPU device is the only backend that never populates `DeviceLimits::maxComputeDispatchThreadGroups`** — Vulkan/CUDA/D3D12/D3D11/Metal/WGPU all set it. Base `Device::initialize` does `m_info = {}` and `DeviceLimits` (in `include/slang-rhi.h`) has **no default member initializers**, so on CPU the limit stays `{0,0,0}`. slangpy PR #995 "Support large dispatches" (commit `32f9834a`) added a clamp `min(limits.x, kSlangPyMaxDispatchThreadGroupsX)` → `min(0, huge) == 0` → the `SGL_CHECK(dispatch_groups_x > 0)` throws.

**Two non-obvious findings for anyone fixing this class of bug:**
1. **Metal precedent for the durable fix:** Metal's device already hardcodes `maxComputeDispatchThreadGroups = {0xffffffff, 0xffffffff, 0xffffffff}` (`slang-rhi/src/metal/metal-device.cpp:217-219`) precisely because it has no hardware grid bound. The CPU fix is a verbatim copy of that. When a "software" backend lacks a real limit, `0xffffffff` sentinel is the established pattern.
2. **A slangpy-only "just relax the SGL_CHECK" fix is a trap:** there are TWO checks in `dispatch_thread_count_from_total_threads`. Fixing only the X `SGL_CHECK(dispatch_groups_x > 0)` (`slangpy.cpp:103`) moves the throw to the sibling `SGL_CHECK(dispatch_y <= limits.y)` (`slangpy.cpp:110-116`), which also fails when `limits.y == 0`. Plus `slangpy/core/generator.py:466-474` emits `dispatch_group_x_stride = 0` (corrupts the group-id flatten `physical_group_id.y * stride + x` for large dispatches; latent for tiny single-row). So a slangpy-side defensive fallback ("treat 0 limit as unbounded") must cover X, Y, and the generator — the RHI-side fix covers all three at once.

**Test gap:** `slangpy/testing/helpers.py` `DEFAULT_DEVICE_TYPES` never includes `cpu` on any platform → no CPU dispatch coverage in CI, which is why this shipped. Add a cpu dispatch smoke test.

**Meta:** This kind of "backend forgot to fill a limit that a new consumer now requires" bug spans two repos (slang-rhi + slangpy submodule bump). Durable fix in slang-rhi; slangpy can carry a defensive fallback + test to unblock before the bump.
