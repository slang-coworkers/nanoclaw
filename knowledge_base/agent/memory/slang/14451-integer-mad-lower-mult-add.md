---
type: chain-record
title: "slang#14451 integer mad() lowers to multiply+add — PR #14452 merged; side-find #14454 held filed-only"
description: Terminal chain record for the integer mad() fix (PR #14452) and the filed-only Metal/WGSL side-find #14454 with its resume condition
---

# slang#14451 — integer mad() lowers to multiply+add (PR #14452)

## Chain state (11-20 07:07Z — FULLY TERMINAL)

- Issue #14451: integer `mad()` lowered to multiply+add (SPIR-V/GLSL/CUDA/CPU failures).
- PR #14452: maintainer pdeayton-nv APPROVED (review 5984980662), head `fb3d9dc` (R1 nits + peer-review
  nits in). Ready-flip 11-20 at unchanged head (30/30 checks green); approver event queued (approver
  paused) but moot — **MERGED 11-20 07:0xZ** (merge commit `f4fc211`, verified live by the triager);
  issue #14451 auto-closed. Sentinel removed, fixer worktree cleaned. No final issue post owed — the
  merged PR carries the trail.
- Backstop task `recheck-14452-merge` cancelled 11-20 (trigger fired early via the merge webhook).

## Side-find #14454 — HELD filed-only (11-20 07:1xZ)

- Bot-filed (nv-slang-bot) by the #14451 chain: integer `mad()` unavailable on `-target metal`/`-target wgsl`
  (E36107) because the integer overloads in `source/slang/hlsl.meta.slang` (~line 13619) are gated
  `[require(cpp_cuda_glsl_hlsl_spirv_llvm, shader5_sm_5_0)]` — missing `metal`/`wgsl`. Body carries full
  verification (master `6862c98ec`, repro, root cause, fix direction = widen the gate). Label `reproduced`.
- **Disposition (filing policy): held filed-only.** Low severity — availability error only (clean E36107,
  trivial `a*b+c` workaround, no wrong-code) — and shepherds loaded (~7 live slang-fixer chains: 14655,
  14652, 14646, 14645, 14612, 14589, 14430). Operator notified on the dashboard 11-20.
- **Resume condition (owner: this orchestrator):** dispatch a fixer on canonical thread
  `gh-issue-shader-slang/slang-14454` when fixer load drops or the operator asks. The fix is small (widen
  the two overloads' gate to include metal/wgsl + metal/wgsl tests); body also notes `shader5_sm_5_0`
  (`GL_ARB_gpu_shader5`) becomes removable for GLSL integer mad after #14452 — fold into the same PR or
  leave as a note; the maintainer can decide at review.
