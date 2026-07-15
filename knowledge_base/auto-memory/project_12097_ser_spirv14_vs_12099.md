---
name: project_12097_ser_spirv14_vs_12099
description: IN-FLIGHT
metadata: 
  node_type: memory
  type: project
  originSessionId: 0c896180-ff45-4841-97a8-b1e68087b6b1
---

**shader-slang/slang#12097** — SER (shader invocation reorder) extensions unconditionally upgrade a requested `spirv_1_4` profile to 1.5. Author + explicit "make a pr" authorization: jkwak-work (core maintainer). Repro CONFIRMED on ToT (HEAD 3eeda847c, deterministic, no GPU): `-profile spirv_1_4 -capability spvShaderInvocationReorderNV` → header `; Version: 1.5` (control `-profile spirv_1_4` alone → 1.4). Verdict posted https://github.com/shader-slang/slang/issues/12097#issuecomment-4972430785. Confirmed bug / low severity / P2. Not a regression. `reproduced` label applied; type `DevRel` human-set, left untouched.

**Root cause (verified):** `source/slang/slang-capabilities.capdef:624` `def SPV_EXT_shader_invocation_reorder : _spirv_1_5 + SPV_KHR_ray_tracing;` (NV + motion aliases inherit) pulls `_spirv_1_5` into target caps → determineSpirvVersion() (spirv-legalize.cpp:2482) → header at emit-spirv.cpp:537. Author's "capdef edit alone insufficient" CONFIRMED: 1.4 path must ALSO emit `OpExtension "SPV_KHR_physical_storage_buffer"` (today only emitted via PhysicalStorageBuffer64 addressing, which SER doesn't trigger) or spirv-val fails.

**Fix approach (A, dispatched to slang-fixer via slang-triager on canonical thread `gh-issue-shader-slang/slang-12097`):** capdef floor to 1.4 + SER emit declares PSB ext on <1.5 path; NV/EXT/motion inherit; 1.5+ profiles keep core 1.5 (no downgrade); version-dependency test on `tests/bugs/gh-11082.slang` (header stays 1.4, required OpExtensions, NV+EXT variants, spirv-val). **DRAFT PR, held until maintainer flips to ready.**

**⚠ 07-14: handoff BOUNCED — slang-fixer container unauthenticated** (literal "Not logged in · Please run /login"). Fix NOT in progress. Triager queued the handoff+memo on canonical thread (NOT retrying, NOT authoring itself). Escalated fixer re-login to operator via orchestrator-dashboard. On recovery: fixer consumes queued memo (approach A, `Closes #12097`); ping slang-triager to forward [Fix Report] upstream. GitHub verdict comment (4972430785, "fix dispatched, draft held") NOT amended — transient infra, stays accurate. See [[project_slang_fixer_auth_outage]].

**⚠ DESIGN TENSION — sibling #12099 (same author, jkwak-work) proposes the OPPOSITE:** reject the conflicting `-profile spirv_1_4`/`-capability spvShaderInvocationReorderNV` combo instead of allowing 1.4. Mutually-exclusive directions for the SAME repro. Flagged on the #12097 issue; triager proceeding with #12097's stated preferred (allow-1.4) path since jkwak explicitly asked for a PR on #12097. NOT blocking (author owns both, can steer). **If #12099 activity or a maintainer decision on 12097-vs-12099 arrives, connect the two — one direction obsoletes the other.**
