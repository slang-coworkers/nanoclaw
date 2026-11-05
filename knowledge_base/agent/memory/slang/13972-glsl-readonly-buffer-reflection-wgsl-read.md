---
type: chain
title: slang#13972 — reflection reports GLSL readonly buffer as mutable vs WGSL var<storage, read>
description: Bot-filed follow-up to #13908 (jkwak-work asked); PARKED on assignee design pick A/B/C/D; GPU-confirmed regression in v2026.21
tags: [slang, reflection, wgsl, slang-rhi, parked]
---

# slang#13972

- **Filed** 2026-10-28 14:23Z by nv-slang-bot at jkwak-work's request (#13908 review thread). Assignee: jkwak-work.
- **Problem.** #13908 (merged 10-28 as `be73630`) makes the WGSL emitter write a GLSL `readonly buffer`
  as `var<storage, read>` in compute too; reflection still says `MUTABLE_RAW_BUFFER` / `READ_WRITE`
  (`slang-reflection-api.cpp` `_calcResourceBindingType`, `spReflectionType_GetResourceAccess`).
  slang-rhi's wgpu layout maps `MutableRawBuffer → Storage`, so pipeline creation should fail
  (WebGPU exact-match rule). **GPU-confirmed 11-04** (below).
- **Triage** cmt 6475473601 (10-28 17:06Z): medium, options A/B/C for jkwak-work. Delta cmt 6527278390
  (10-30), edited in place 11-04 16:03Z to say v2026.21 (published 11-04 00:14Z) contains `be73630`
  (verified: compare be73630...v2026.21 behind_by 0). Edits do not notify.
- **Sessions.** Canonical triager session `sess-1793206628501-a4ah2t` (idle since 10-28); re-checks run
  as one-shot task sessions (t-c20e94 11-04; next t-72709c 11-11 16:00Z, triager's group — not visible
  from Main's `ncl tasks list`).
- **2026-11-04 Orchestrator decision:** the released-regression fact is material and the edit was
  silent, so authorize ONE fresh @jkwak-work ping now (optional bounded GPU confirm first). The 11-11
  re-check does not ping again; if still silent it goes on the operator's weekly list.
- **11-04 16:13Z ping posted** cmt 6635682718 (edited 16:15Z with bisect). Triager confirmed on L40S, about 7 min:
  slang `3da6f63c0` + slang-rhi `30250fa` WGPU/Dawn 138.0.7204.168. `createComputePipeline` E_FAIL,
  "ReadOnlyStorage ... not compatible with ... Storage". Release bisect: v2026.20 OK, v2026.21 fails.
  Labels `regression` + `reproduced`, Type Bug (verified). Repro lives in the triager's workspace `repros/13972/`.
- **Side-find (not #13908):** GLSL compute on slang-rhi WGPU writes only `Out[0]` (`2 0 0 0` vs `2 4 6 8`),
  also on v2026.20 and without `readonly`; the Slang-syntax twin is correct. **11-04 16:22Z: duplicate of
  [#14256](14256-glsl-local-size-lost-non-shader-entry-point.md)** (API-path `local_size_x` lost; fix = draft #14275). Not filed, not posted.
  Triager's build dirs `build-13972`, `build-13972-vk` in its slang-rhi clone are kept for re-runs until #13972 closes.
