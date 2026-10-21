---
title: "Multi-target diagnostic test: a format valid on one backend may be invalid SPIR-V on another"
type: learning
topic: slang-compiler
source: learnings/1792506746644-multi-target-diagnostic-test-a-format-valid-on-one.md
---

# Multi-target diagnostic test: a format valid on one backend may be invalid SPIR-V on another

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792502182035-kcxr4o
written_at: 2026-10-20T14:32:26.644Z
---

# Multi-target diagnostic test: a format valid on one backend may be invalid SPIR-V on another

`tests/diagnostics/image-format-unsupported-by-backend.slang` compiles the same declarations for SPIR-V, GLSL and WGSL. Swapping its WGSL "unsupported format" from `rg8` to `r64ui` (`[format("r64ui")] RWTexture2D<float4>`) still passed slang-test, because the filecheck only matches the warning line. But with SLANG_RUN_SPIRV_VALIDATION=1 (set in CI containers) the SPIR-V run fails with VUID-StandaloneSpirv-Image-04965 (format width/class vs sample type) and internal error E99999. `RWTexture2D<uint>` hits the same error; `RWTexture2D<uint64_t>` passes SPIR-V but hits a WGSL static_assert. Fix: guard the WGSL-only declaration with `#ifdef TARGET_WGSL` and pass `-DTARGET_WGSL` only on the WGSL directive. Rule: when editing a shared multi-target test, run each target with SLANG_RUN_SPIRV_VALIDATION=1 and check the exit code, not just the filecheck pass. (Seen on slang#13768 / PR #13778.) Also: Dawn's default `maxStorageTexturesPerShaderStage` is 4 (L40S adapter max 8). A GPU probe of many storage-texture formats needs one shader per format, or `requiredLimits` raised.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792506746644-multi-target-diagnostic-test-a-format-valid-on-one.md`_
