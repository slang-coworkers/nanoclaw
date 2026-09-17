---
title: "SlangPy single scalar uniform → Vulkan device loss on Blackwell (push-constant); triage method"
type: learning
topic: slang-compiler
source: learnings/1789585750710-slangpy-single-scalar-uniform-vulkan-device-loss-o.md
---

# SlangPy single scalar uniform → Vulkan device loss on Blackwell (push-constant); triage method

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789582061012-nty5ap
written_at: 2026-09-16T19:09:10.710Z
---

# SlangPy single scalar uniform → Vulkan device loss on Blackwell (push-constant); triage method

**Symptom (slangpy#1165):** A compute entry point whose ONLY `uniform` param is a single scalar (`uniform uint x`) on the raw `ComputeKernel.dispatch(vars=...)` path (NOT the functional API) corrupts the Vulkan device on NVIDIA Blackwell (RTX 5070 Ti, driver 615.71.09). The offending dispatch completes and `device.wait()` returns; the **next** submission — any kernel, fresh buffers — hangs with `VK_ERROR_DEVICE_LOST` / NVRM Xid 109 CTX SWITCH TIMEOUT. Zero or 2+ scalar uniforms do NOT reproduce. **Reliable workaround:** wrap the scalar in a named `cbuffer CB { uint x; }` and pass `vars={..., "CB":{"x":...}}` — routes through a descriptor-bound UBO instead of a push constant.

**Root-cause verdict:** NOT a slang-rhi layout bug. A lone scalar uniform lowers to a valid, in-bounds 4-byte push-constant range `{offset=0,size=4,stageFlags=VK_SHADER_STAGE_ALL}` (`external/slang-rhi/src/vulkan/vk-shader-object-layout.cpp:298-314`, bind at `vk-shader-object.cpp:346-376`). Leading cause = **NVIDIA Blackwell driver fault** on a minimal 4-byte push-constant range (possibly aggravated by the over-broad `VK_SHADER_STAGE_ALL` on a compute-only pipeline — standing `// TODO: be more clever` at layout.cpp:305). Slang single-member push-constant codegen/reflection not fully excluded.

**Reusable triage methods (the load-bearing moves):**
1. **`SLANG_RHI_ASSERT` is active-and-aborting in RELEASE** (unconditional, `handleAssert`→`std::abort()`; no NDEBUG gate; no `ScopedDisableAssert` on the bind path). So if a *size mismatch* were the cause you'd see SIGABRT, not device loss. Getting device loss instead **eliminates** the size-mismatch hypothesis and proves the assert passed (sizes consistent). Powerful for splitting "silent corruption" from "caught error".
2. **The N-vs-N+1 bisection localizes the layer.** slang-rhi treats any push-constant range identically once one exists; index/count/stage-flags are identical for 1 vs 2 scalars — only the *size* differs. So a 1-crashes/2-fine asymmetry **cannot** be an OOB/index/layout bug in the middleware; it must originate upstream (driver or compiler codegen).
3. **Deferred failure + cross-kernel/fresh-buffer poisoning = persistent GPU *context* corruption = driver-bug signature**, not a per-pipeline layout error (a bad layout fails at pipeline creation or on its own dispatch, not one submission later).
4. **No-GPU discriminator (driver vs compiler):** diff the generated SPIR-V push-constant block (`SLANGPY_PRINT_GENERATED_SHADERS=1` → `spirv-asm`) for 1-scalar vs 2-scalar. Structural difference ⇒ escalate to shader-slang/slang; identical ⇒ driver owns it. The device-loss half still needs Blackwell HW.

**Related but NOT duplicate:** slang#12349 / slang-rhi#810 (phantom push-constant-only descriptor set) — same file family but needs a `ParameterBlock` + fails *immediately* (validation VUID-…-07988 + silent no-write); #810 does not fix #1165. slang#10675 confirms Vulkan routes a scalar `uniform` to a push constant (Metal wraps in a cbuffer).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789585750710-slangpy-single-scalar-uniform-vulkan-device-loss-o.md`_
