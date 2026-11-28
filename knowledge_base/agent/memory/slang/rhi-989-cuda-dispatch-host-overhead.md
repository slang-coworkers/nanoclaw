---
type: chain-record
title: slang-rhi #989 — CUDA compute-dispatch host-time overhead vs raw cudaLaunchKernel
description: Version-keyed compute-state reuse shipped at draft PR #990 (final head 5259ff2); chain closed bot-side; parked on human review; ready-flip weekly list
tags: [slang-rhi, performance, cuda, command-recording]
---

# slang-rhi #989 → PR #990 (FIX-SHIPPED, parked on human review, 11-25)

Human-filed 11-25 13:03Z (albertrodriguezclo, no labels): each CUDA compute dispatch through
slang-rhi costs ~1.2-1.9 µs more host time than a raw `cudaLaunchKernel` (RTX 4060 Ti, main
`c3e6b26f`). Routed to slang-triager on canonical thread `gh-issue-shader-slang/slang-rhi-989`;
issue 👀 + `enhancement` label (triage cmt; no `reproduced` label exists in slang-rhi).

**Triage verdict (P2, command recording + CUDA backend):** reproduced at the reporter's exact
commit on L40S (raw 1.94 µs vs rhi benchmark-command 8.0 µs). Root cause: every dispatch
unconditionally re-records compute state — per-call `createRootShaderObject` in `bindPipeline`
(command-buffer.cpp:223-234), `prepareBindings`→CUDA `bindAsRoot` full rebuild
(cuda-shader-object.cpp:93-135), plus a D2H/D2D global-params `cuMemcpyAsync` per dispatch
(cuda-command.cpp:696). No dirty-state reuse anywhere; CUDA `BindingCache` stubbed;
`ShaderObject::m_version` bumped on every mutation but consumed by nothing — the intended dirty
signal. Related: #955 (maintainer welcomed a reuse PR 2026-11-10), #861. Not a dup.

**Fix (draft PR #990, branch `fix/issue-989`, review complete at head `45104c6`, 11-25):**
version-keyed compute-state reuse in `ComputePassEncoder` (`canReuseRecordedComputeState`:
pipeline + root + command list + reset generation + folded version); honest version signal
(value-preserving bumps, both FNV steps on every fold component, hook repairs via 16-byte window
compare); `bindPipeline` root reuse; Vulkan `requireBindingStates` per state set; **D3D12 keeps
full re-binding per state set** — its debug layer rejects a dispatch reusing root bindings
recorded before an intervening copy (windows-Debug-only, isolated via two diagnostic CI rounds,
fixed at `c706590`; record-side caching still applies there); CUDA global-params copy memo (reset
per execute and by callbacks); `ShaderCursor` name-scan-first fast path. 29 commits, 16 files,
+913/-108. Guard tests on `test-binding-reuse.slang` (mutation, persistence, EP fold, copy
hazard, version contract, two-arg bindPipeline, negative-control-verified clobber-then-rebind).

**Numbers:** benchmark-command.cuda 8.2 → 3.7-3.8 µs/dispatch vs 1.94 µs raw floor =
70-72% gap closure (acceptance ≥70% met at every round; triager's independent L40S run
confirmed 8.0 → 3.7). Guard tests 12/12 on cuda+vulkan+wgpu in Release AND Debug (validation on);
full suites cuda+vulkan 1133/1133 both configs; PR CI green at final head (27 checks incl.
windows x86_64 Debug).

**Review:** two rounds (limit). R1 (2 bugs, 9 gaps) fully applied. R2 (3 bugs, 7 gaps): 3 bugs
fixed (hook-repair versioning, overflow-free bounds, indexed-cursor bounds), 5 gaps applied;
**declined with justification:** reserveData end-to-end test (documented contract, zero in-tree
callers) and CUDA callback end-to-end memo test (kernel plumbing beyond this PR; reset is
defensive and code-reviewed) + FG007/FG011 comment nits. Round-2 review caught a vacuous
regression check — fixed with backend gating + negative control.

**Side-finding disposition:** the Vulkan entry-point-uniform ParameterBlock reads-0 bug surfaced
by the guard test dedupes onto **slang-rhi#915** (triager reproduced on main `c3e6b26f`:
Vulkan all-zeros vs CUDA correct, first dispatch, no reuse involvement; evidence
issuecomment-7170762700). No new issue, no new chain — parked on #915.

**Artifacts:** issue status cmt [issuecomment-7166476225](https://github.com/shader-slang/slang-rhi/issues/989#issuecomment-7166476225);
triage delta cmt issuecomment-7167052965; PR explanation cmt issuecomment-7166469733 (follows head
45104c6). Owner: fixer session `sess-1795612589316-vfgn30` on `gh-issue-shader-slang/slang-rhi-989`
(worktree + sentinel retained until PR disposition). Fixer memory: `memory/fix-rhi-989.md` (its
group); triager state: `memory/issues/slang-rhi-989.md` (its group).

**Standing:** chain CLOSED bot-side 11-27 02:27Z ([Triage Resolution] delivered; final head
`5259ff2` — re-verified at that head: 3.7 µs/dispatch, guards pass, CI green all platforms,
MERGEABLE; review request with kaizhangNV via board-sync shepherd; issue status cmt
issuecomment-7167052965 patched to final resolution). Draft PR #990 awaits human review/merge —
P2 enhancement, **no per-PR un-draft ask** (weekly list carry-over row added); resume on PR
webhook only. Post-merge: un-skip `compute-binding-reuse-entry-point-mutation.vulkan` once
rhi#915 lands.

**Infra note (operator-notified 11-27, addendum same day):** during this chain the reviewer infra
errored twice (18:34Z, 19:20Z Nov 25) and the fixer's session hit **four** generic "couldn't
answer" failures (session-1 pre-repro; 01:57Z Nov 27 ate one [Fix Report]; 22:33Z Nov 27 on
post-close upkeep — that one lost nothing, verified live; fixer re-engaged, msg 71). Pattern
spans both slang-fixer and slang-reviewer runners; operator asked for a runner-log look
(dashboard msg 43 + addendum 47). Standing risk: the fixer holds PR #990's webhook mapping —
if its session is dead when a human review event arrives, the host redrive + supervisor tick are
the backstop.
