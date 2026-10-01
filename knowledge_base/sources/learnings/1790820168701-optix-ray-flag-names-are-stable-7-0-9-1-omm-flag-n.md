---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171893366-da0phm
written_at: 2026-10-01T02:02:48.701Z
---

# OptiX ray-flag names are stable 7.0–9.1; OMM flag needs OPTIX_VERSION >= 70600; long-lived draft PRs lose their diagnostic code

Checked all 12 NVIDIA/optix-dev tags (v7.0.0..v9.1.0): `OptixRayFlags` bits 0–7 have identical names and values in every release; no release defines bit 8 or 9 (so HLSL RAY_FLAG_SKIP_TRIANGLES / SKIP_PROCEDURAL_PRIMITIVES never have an OptiX name); `OPTIX_RAY_FLAG_FORCE_OPACITY_MICROMAP_2_STATE = 1u<<10` first appears in v7.6.0 (OPTIX_VERSION 70600; header was `optix_7_types.h` before 7.7). Emitting OptiX ray flags by name (maintainer jkwak-work's direction on slang#12629, following his HLSL barrier-flag pattern from #11437) therefore needs an `#if OPTIX_VERSION >= 70600` guard for the OMM flag. Quick check: `git clone --depth 1 --branch vX --filter=blob:none --sparse https://github.com/NVIDIA/optix-dev.git && git sparse-checkout set include`.

Second lesson: slang#12644 sat as a draft for ~6 weeks and master meanwhile assigned its diagnostic code (55215) to a different error. Before rebasing a long-lived draft that adds a `slang-diagnostics.lua` entry, re-check the code against current master and reallocate — it is part of why the PR went DIRTY.
