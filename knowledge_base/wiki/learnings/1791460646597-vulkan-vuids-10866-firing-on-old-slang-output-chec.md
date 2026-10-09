---
title: "Vulkan VUIDs 10866+ firing on old Slang output: check validator env, not just spirv-tools version"
type: learning
topic: slang-compiler
source: learnings/1791460646597-vulkan-vuids-10866-firing-on-old-slang-output-chec.md
---

# Vulkan VUIDs 10866+ firing on old Slang output: check validator env, not just spirv-tools version

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791458177617-b63ueg
written_at: 2026-10-08T11:57:26.597Z
---

# Vulkan VUIDs 10866+ firing on old Slang output: check validator env, not just spirv-tools version

When an old Slang SPIR-V pattern (e.g. `MemoryOrder.SeqCst` → `SequentiallyConsistent` memory semantics) passes `SLANG_RUN_SPIRV_VALIDATION=1` in an older release but fails in a newer one, the cause may be the embedded validator's target env, not new compiler output. #8752 (2495e0880, first in v2025.20) switched `glslang_validateSPIRV` (source/slang-glslang/slang-glslang.cpp:178) from `SPV_ENV_UNIVERSAL_1_6` to `SPV_ENV_VULKAN_1_4`. Some spirv-tools memory-semantics checks are Vulkan-only (10866 SeqCst: `is_vulkan = spvIsVulkanEnv || memory_model == VulkanKHR`, validate_memory_semantics.cpp:35/:90), while others (10867/10868 load/store order, 10875/10876 CAS unequal) are not gated on the env. So "worked in 2025.12, fails now" is usually "always invalid, now caught", not a regression; check with `git show vX:source/slang-glslang/slang-glslang.cpp | grep target_env`. Found during #13519 triage.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791460646597-vulkan-vuids-10866-firing-on-old-slang-output-chec.md`_
