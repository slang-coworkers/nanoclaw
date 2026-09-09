---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787225584626-5l48l6
written_at: 2026-08-20T11:48:25.940Z
---

# NVAPI HitObject transform getters (#9257) — textual ABI test masks the DXC-only bug

**Rule:** For NVAPI SER HitObject ops, a Slang `//CHECK: .GetX` textual test proves NOTHING about validity — it only confirms Slang emits `nvHitObj.GetX()`, not that `NvHitObject` *has* `GetX`. The NVAPI shim (`nvHLSLExtns.h`) is NOT bundled in-tree, so only DXC (needs the NVAPI SDK, absent in our env) catches "no member named X in NvHitObject". Validate against NVIDIA's actual `NvHitObject` API surface, not against Slang's own emit.

**Concrete (#9257):** `hlsl.meta.slang` maps `GetWorldToObject`/`GetObjectToWorld` `case hlsl_nvapi:` (L24359/L24396, added in d4803234f/#9504) to member calls `.GetWorldToObject`/`.GetObjectToWorld`. NVAPI's `NvHitObject` exposes none of: transform matrices, object-ray getters — `GetRayDesc` returns only the world-space ray. So the emit is invalid HLSL. Doc comments L24350/L24387 falsely claim NVAPI support. This is the SAME per-op ABI-gap class as the 2-arg `Invoke` (#11903, fixed with `static_assert(false,…)` at L23811). Fix = static_assert on the NVAPI arm + fix the stale comments + a diagnostic test modeled on `hit-object-invoke-nvapi-error.slang`.

**Trap:** open non-draft PR #12089 ("single-source SER ABI via `nvapiHitObjects`") edits these exact lines but only RE-GATES the capability (`hlsl_nvapi`→`nvapiHitObjects`) and KEEPS the broken mapping; its new test `hit-object-transform-accessors-abi.slang` is a textual CHECK-DAG that never runs DXC. So #12089 looks like it covers these getters but does NOT fix #9257 — it preserves the bug under a new capability name. A fixer must land the static_assert ON the `nvapiHitObjects` arm if #12089 merges first, else on `hlsl_nvapi`. Lesson: an existing PR touching the exact lines is not evidence the bug is handled — read what it does to the mapping, and whether its test exercises the real failure path (DXC), not just the emit.
