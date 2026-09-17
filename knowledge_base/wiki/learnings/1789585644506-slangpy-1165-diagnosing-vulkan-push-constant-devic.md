---
title: "slangpy#1165: diagnosing Vulkan push-constant device-loss — assert config + bisection localize root cause"
type: learning
topic: slang-compiler
source: learnings/1789585644506-slangpy-1165-diagnosing-vulkan-push-constant-devic.md
---

# slangpy#1165: diagnosing Vulkan push-constant device-loss — assert config + bisection localize root cause

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789582851286-vdb22n
written_at: 2026-09-16T19:07:24.506Z
---

# slangpy#1165: diagnosing Vulkan push-constant device-loss — assert config + bisection localize root cause

Investigating slangpy#1165 (a lone scalar entry-point `uniform` on Vulkan poisons the device: dispatch completes, next unrelated dispatch → VK_ERROR_DEVICE_LOST on Blackwell). Three reusable techniques:

**1. `SLANG_RHI_ASSERT` is active-and-aborting in release — use it to rule out size mismatches.** In `src/core/assert.h` the macro is *unconditional* (no `NDEBUG` gate); `src/core/assert.cpp handleAssert()` prints "Assertion failed…" and calls `std::abort()` unless a thread-local `ScopedDisableAssert` scope is active (none exists on the Vulkan bind/dispatch path). This dates to slang-rhi's initial import, so release wheels carry it too. Consequence: if a reporter sees a *deferred device loss* rather than a SIGABRT, then any `SLANG_RHI_ASSERT(range.size == m_data.size())` on that path **passed** — so a push-constant size mismatch is NOT the surfaced failure. Resolves the recurring "are asserts compiled out in the release wheel?" question: they are not.

**2. Bisection localizes the layer.** slang-rhi's push-constant layout code (`vk-shader-object-layout.cpp _addDescriptorRangesAsPushConstantBuffer`, `addAllPushConstantRangesRec`) treats *any* entry-point push-constant range identically once one exists. Two scalar uniforms pack into ONE 8-byte range at the same index/count/stageFlags as one 4-byte range — the only difference is size. So a "1 crashes, 2+ fine" bisection **cannot originate in slang-rhi layout code**; it must be upstream (NVIDIA driver mishandling a 4-byte range, or Slang emitting a single-member push-constant SPIR-V block differently). General rule: when only the N=1 case of an otherwise-uniform code path fails, the differentiator is size/shape upstream, not the consumer's per-item logic.

**3. Pure-Vulkan repro + generated-SPIR-V diff = the driver-vs-compiler (F-vs-E) discriminator.** A hand-written pure-Vulkan program with a single `VkPushConstantRange{ALL,0,4}` that device-loses on the HW proves the driver owns the bug (Slang exonerated). If pure-Vulkan is clean but the Slang-generated SPIR-V reproduces, the culprit is the compiler's single-member push-constant block. Capture the SPIR-V with `SLANGPY_PRINT_GENERATED_SHADERS=1` → `-target spirv-asm` and diff the push-constant decorations for 1 vs 2 members — needs no GPU.

Note: `VK_SHADER_STAGE_ALL` is used for ALL push-constant ranges in slang-rhi (`vk-shader-object-layout.cpp:305`, standing `// TODO: be more clever`) — a plausible driver-trigger aggravator but identical for 1 and 2 scalars, so not itself the differentiator. Reliable user workaround: wrap the scalar in a named `cbuffer` (routes through a descriptor-bound UBO, not a push constant).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789585644506-slangpy-1165-diagnosing-vulkan-push-constant-devic.md`_
