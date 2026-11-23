---
type: chain-record
title: "slang#14687: warped-sampling-1d.slang cross-workgroup race (flaky T4 CI test)"
description: "Human-filed 11-21 (jkwak-work). Test bug: 4,1,1 dispatch + workgroup-scoped barrier → cross-workgroup partial sums; both vk+glsl legs flaky on L40S. Draft PR #14689 (test-only) peer-reviewed, parked on human review + CI."
---

# slang#14687 — warped-sampling-1d.slang (glsl) fails at random on Linux T4

- **Filed** 11-21 05:45Z by jkwak-work (maintainer). issue_opened → triager k6b0d7→(triager sess xpgwqh), 👀 + dispatch same minute.
- **Triage** (triager, 06:07Z): bug (test bug), medium/P2, CI test-infra. Test kernel dispatches 4,1,1 × 256 threads; all threads `InterlockedAdd` into `endpointDifferentialBufferInt[0..3]` but only WG-0 threads read totals after `AllMemoryBarrierWithGroupSync()` — workgroup-scoped on every leg (verified emission `hlsl.meta.slang:8627-8661`; GLSL leg `controlBarrier(Workgroup, Device)` → `OpControlBarrier Workgroup Device`). Cross-workgroup sync impossible by design → partial sums, run-to-run nondeterminism.
- **Reproduced on L40S master 0a87e8963:** both vk (8/20) and glsl (10/20) legs flaky — CI's glsl-only failures are timing luck, not codegen. Not a compiler bug; PRs #14561/#14662 (per-target COMPARE_COMPUTE) exposed the latent race. NOTE: the expected-failure-linux.txt entry the issue claims does NOT exist on master or the #14674 branch.
- **Fix** (fixer sess cjhbhb, [Fix Report] 09:08Z): test-only, Approach A — `-compute-dispatch 4,1,1`→`1,1,1` + CHECKs re-derived (−0.264/0.262/0.000/0.001; small-value widened to `0.00{{[01]}}000`). Rejected numthreads(1024) alternative: cuda leg aborts CUDA_ERROR_LAUNCH_OUT_OF_RESOURCES. **Draft PR #14689** @ head 1880bd2 (fix 14fc31a + nits 1880bd2, 1 file +19/−6), pr-mapping → fixer session.
- **Verification:** post-fix 30/30 serial `-api vk` file-runs (vk+glsl legs), 5/5 cuda, was/ suite 3/3, probe read-back byte-identical. dx12 leg CI-only. Peer review APPROVE_WITH_NITS (4 doc/robustness nits applied); Codex PLAN/CODE/OUTPUT_REVIEW approved.
- **PARKED 11-21 on human review of draft PR #14689 + CI** (30 check-runs in flight at 09:1xZ). Ready-flip pending → weekly un-draft list (no per-PR ask; P2 test-infra). Resumes on webhook (pr-mappings routes PR events; issue comments canonical thread `gh-issue-shader-slang/slang-14687`). supervisor-state disposition `awaiting_human`.
- Fixer worktree `wt-slang-14687` retained until PR disposition. On merge: no expected-failure entry to remove (none exists on master).
