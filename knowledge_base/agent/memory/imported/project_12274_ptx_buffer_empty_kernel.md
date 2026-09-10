---
name: project_12274_ptx_buffer_empty_kernel
description: "slang#12274 [PTX] typed Buffer<T>.Load silently emits an empty CUDA/PTX kernel. RESOLVED (Approach A / E36107 diagnostic, PR #12289 merged, issue auto-closed). ONE live deferred item: the SlangPy pin-bump."
metadata:
  node_type: memory
  type: project
  originSessionId: bf28cc43-ed22-4083-b4ab-072df74f26be
---

# slang#12274 — typed `Buffer<T>` silent empty CUDA/PTX kernel — RESOLVED (A)

## ⏳ ONLY LIVE ITEM — Stage-2 SlangPy pin-bump (deferred, Main-owned)
SlangPy `external/CMakeLists.txt` `SGL_SLANG_VERSION` downloads a slang **release tarball**,
not a SHA. #12289 is in slang **master** but was **not** in a release tag as of merge
(latest release `v2026.14.1` was published 07-30, before #12289 merged 07-31 23:53Z).
**RESUME TRIGGER: the first slang release tag published after 07-31 23:53Z that contains
merge commit `0af96e444b`** → signal slangpy-fixer to bump `SGL_SLANG_VERSION`. Until then no
action; SlangPy CI stays green on the current pin (the #1083 guard is a no-op there). The
guard is the correct permanent shape — do **not** drop it unless Buffer-on-CUDA (Approach B)
ever lands.

## The bug + root cause
`Buffer<float4>` read → `RWStructuredBuffer<float4>` write for `-target ptx`/`cuda` compiled
with **no diagnostic** but silently omitted the load+store (PTX entry was just `ret;`).
Root cause (compile-only, verified): `Buffer<T>` = `_Texture<T,__ShapeBuffer,...>`;
`_Texture.Load`'s `__target_switch` has no `cuda` case, so a case-less switch emitted an
**empty helper body** and NVVM stripped the dead ops. `__ShapeBuffer`'s type-level
`[require(cpp_cuda_glsl_hlsl_metal_spirv)]` admitted cuda, but the case-less `Load` switch
inferred an empty capability set, so the method-level `require` never enforced. Resembles
**#6304** (WGSL silent empty shader) but distinct — no prior PTX/CUDA issue.

## Resolution (Approach A — fail loudly)
- **PR #12289** (`fix/issue-12274`): drop `cuda` from the `Load` require →
  `[require(cpp_glsl_hlsl_metal_spirv)]`, so typed `Buffer<T>` on CUDA/PTX now emits a clean
  **`E36107`** instead of a silent empty kernel (exact WGSL precedent **PR #6585**,
  `pr: non-breaking`). Kept `cpp` in scope (CPP has a real `Buffer<T>` prelude type — its gap
  is Approach-B, out of scope). Regression test
  `tests/diagnostics/cuda-typed-buffer-unsupported.slang`. Maintainer csyonghe APPROVED;
  jkwak briefly requested Approach B (implement Buffer-on-CUDA) then converged back to A when
  the fixer showed `Buffer<T>` needs `tex1Dfetch`, which PTX doesn't provide (the prelude
  `tex1Dfetch` impl is `#if 0`'d). Merged 07-31 23:53Z (`0af96e444b`); **#12274 auto-closed
  COMPLETED** via `Fixes #12274`.
- **Cross-repo collateral, fixed in tandem — slangpy#1083 (MERGED).** #12289's new E36107
  fired on SlangPy's downstream `tests/device/test_buffer.slang copy_buffer_uint` (typed
  `Buffer<uint>` on CUDA). The 4 CI failures were **collateral**: Slang fails whole-module
  load on one bad entrypoint, so the CUDA-clean sibling entrypoints in the same module became
  unreachable. `copy_buffer_uint` was already `pytest.skip`-ped on CUDA, so no test relied on
  the silently-broken behavior. Fix = guard it with `#ifndef __TARGET_CUDA__` (slangpy#1083,
  merged by jkwak). Because **SlangPy Tests is a REQUIRED check on #12289**, the guard on
  SlangPy `main` was the *prerequisite* that greened #12289, not a follow-up.

## Durable lessons (already extracted to linked concepts)
- A required cross-repo check inverts ordering: the downstream guard is the thing that
  unblocks the upstream PR. Land the prereq first.
- A CUDA-only diagnostic PR inheriting a red D3D12 Falcor check via a UI merge-from-master is
  an unrelated flake — [[project_12145_gbufferrttexgrads_d3d12_access_violation]].
- A bot PR's `ci_failed` from a `workflow_dispatch` priority-yield is cosmetic, not a real
  failure — [[project_bot_pr_priority_yield_red_run]].
- A maintainer flipping a bot draft to non-draft is a human action, not a bot breach —
  [[project_12265_byteaddressbuffer_atomic_shared_type_mutation]].
- A pushed branch with no PR is invisible to every human surface; re-measure before
  escalating a stall (a container-restart gap can exceed the stall).
- Related CUDA cluster: [[project_12192_e55215_constantbuffer_no_source_location]],
  [[project_12273_cuda_callable_output_crash]] (distinct root — #12274 ≠ #12273).

_(Historical: the minute-by-minute 07-30/07-31 A/B-fork, required-check discovery, merge-queue
eviction+nudge, and re-run choreography were pruned 2026-09-09 on synthesis; the live Stage-2
item and durable lessons above carry what remains actionable.)_
