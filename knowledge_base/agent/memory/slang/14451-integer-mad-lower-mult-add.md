---
type: chain-record
title: "slang#14451 integer mad() lowers to multiply+add — PR #14452 approved; side-find #14454 parked until merge"
description: Terminal chain record for the integer mad() fix (PR #14452) and the filed-only Metal/WGSL side-find #14454 with its routing trigger
---

# slang#14451 — integer mad() lowers to multiply+add (PR #14452)

## Chain state (11-19 23:22Z)

- Issue #14451: integer `mad()` lowered to multiply+add (SPIR-V/GLSL/CUDA/CPU failures).
- **PR #14452 TERMINAL on our side 11-19:** maintainer pdeayton-nv APPROVED (review 5984980662, verified
  live via `gh api`), head `fb3d9dc` (R1 nits + peer-review nits in), full CI running, `mergeable_state: behind`
  (no update requested by anyone — no merge-master dispatch, per rebase rule). Merge is the maintainer's.
- **Ready-flip 11-20:** draft→ready at unchanged head `fb3d9dc` (30/30 checks green, still pdeayton-approved).
  First approver event: slang-pr-approver paused=1, so NOT forwarded — queued in
  `data/approver-pause-queue.md` for dispatch on unpause (skip if merged by then, which is likely).
- Fixer stands by to clean up its worktree on the merge/close webhook; triager chain closed, no open threads.

## Side-find #14454 — filed-only, parked with a trigger

- Bot-filed (nv-slang-bot) by the #14451 chain: integer `mad()` unavailable on `-target metal`/`-target wgsl`
  (E36107) because the integer overloads in `source/slang/hlsl.meta.slang` (~line 13619) are gated
  `[require(cpp_cuda_glsl_hlsl_spirv_llvm, shader5_sm_5_0)]` — missing `metal`/`wgsl`. Body carries full
  verification (master `6862c98ec`, repro, root cause, fix direction = widen the gate). Label `reproduced`.
- **Disposition: filed-only until #14452 merges.** The fix touches the same two overloads #14452 changes —
  side-find discipline: no new fixer chain while the related draft is in flight (approved, merge imminent).
- **Trigger (owner: this orchestrator):** when #14452 merges (fixer's cleanup report, or the one-shot task
  `recheck-14452-merge`, fires ~11-21T00:00Z), decide the #14454 fixer start. Filing policy: starting a fixer
  chain on a bot-filed issue is reported/held, not auto-dispatched — at trigger time either dispatch with a
  dashboard note or hold as filed-only per shepherd load. The fix is small (gate widening + metal/wgsl tests);
  body also notes `shader5_sm_5_0` becomes removable for GLSL after #14452.
