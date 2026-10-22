---
type: project
name: project_13771_metal_rwtexture_fence
description: "slang#13771 (albertrodriguezclo, external): Metal never fences an access::read_write texture between same-thread write and read. Bot DRAFT PR #13792 (fixer i4wuxx on triager edge epsn3s) fences before AND after each write; R2 APPROVE_WITH_NITS, nits applied @accfd0d97f. PARKED ON OPERATOR (live 10-22 00:0xZ: still draft/OPEN @accfd0d97f): run 39530615997 waiting — bot CI livelocked at the priority gate + falcor-ci; needs a human ci.yml dispatch or an approved ready-flip. No timer; /supervise-issues walks it via _meta.operator_decisions."
metadata:
  node_type: memory
  type: project
---

# slang#13771: Metal RWTexture write→read needs `fence()`

Dated history (triage, review rounds, every CI check): [[project_13771_metal_rwtexture_fence_history]].
New dated entries go there; this file holds the current state and the decisions.

## Current state (verified live 2026-10-22 00:0xZ)

- **PR [#13792](https://github.com/shader-slang/slang/pull/13792)** `fix/issue-13771`, DRAFT, OPEN,
  head `accfd0d97f`, last update 10-21 19:14Z. pr-mapping → fixer `sess-1792504449151-i4wuxx`, on the
  triager's edge `epsn3s` (triager `sess-1792502067447-0onhoa`, thread `gh-issue-shader-slang/slang-13771`).
- **Blocked on a human.** No build or test job has ever run on any head. Run **39530615997** is
  `waiting`: `wait-for-human-priority` yielded, pending deployment `falcor-ci`
  (`current_user_can_approve:false`). The bot retry workflow will not rerun while ci.yml has 80+
  `waiting` runs, because `waiting` ∈ `ACTIVE_STATUSES` (livelock, see
  [[feedback_a_status_set_broader_than_its_docstring_livelocks_the_throttle]]), and any bot dispatch
  re-enters the gate (`IS_THROTTLED_BOT`, ci.yml:101).
- **Options put to the operator** (asked 02:0xZ, re-asked once 14:0xZ — final; a 19:2xZ delta relayed the
  reporter's public request): (1) a human `gh workflow run ci.yml --ref fix/issue-13771`; (2) approve a
  ready-flip (pull_request CI, full priority); (3) approve the `falcor-ci` gate. The reporter's
  blocking ask is a green macOS run before it leaves draft (METALLIB lines are the only proof Apple
  accepts `fence()` on texture_buffer, ROV and `_slang_textureFence`); they asked maintainers for it on
  the PR (cmt 6324333622); the fixer answered with the remedy (6324379785).
- **Coworker tiers hold:** no re-dispatch, no ready-flip. When a real run lands, the triager checks
  the macOS logs (`Metal: not supported`). On the operator reply or a CI/ready webhook, route through
  slang-triager on the canonical thread. If a `pr_ready_for_review` arrives, check approver `paused`
  first ([[../pr-approvers-paused.md]]).

## Design (Approach A, as shipped)

- A `metalTextureFence` IR op, inserted by a Metal pass after `legalizeImageSubscript`, **before and
  after** each write to a read_write-class texture (ImageStore, the RWBuffer setter moved onto
  ImageStore, texture atomics — the pre-write fence sits before the ImageSubscript chain for
  dominance). Emitted as a by-value `_slang_textureFence(tex)` prelude helper, which avoids the
  const-member problem. Only the trailing fence is in the MSL spec (4.1 §6.13.17); the leading one is
  from hardware evidence (Dawn, M1).
- **Shared-helper change, all targets:** `canInstHaveSideEffectAtAddress` (slang-ir-util.cpp) gains a
  case: a texel write cannot change an address that holds resources. Without it the fence's second use
  of `getElement(load(kc.arr), i)` stopped `simplifyForEmit` sinking the load, copying the whole
  texture-handle array to a local (invalid MSL for an unsized `arr[]`). The revert drill fails; 156
  files show 0 non-Metal diffs. The PR Risk line names it.
- **Out of the PR, follow-ups:** shared texel-atomic helper, an HLSL/GLSL alias-query test, removing
  redundant fences (the reporter's cost point), and spin-off **#13796** (`RasterizerOrderedBuffer<T>`
  write-only on every target, regression from #5454; owned by sibling Main `fun2vl`). Once #13796 is
  fixed, ROB buffers get fenced by #13792's ImageStore path automatically.

## Decisions and lessons

- **Ownership guard for an external reporter who often fixes their own issues** (#13766 → own PR in
  27 min; #13753 → our fixer stood down): approve the triager→fixer handoff, but re-read the issue and
  the reporter's open PRs before opening a PR and before each push. Here the reporter declined
  (cmt 6293057817) and offered review.
- **"Send one report" read as "I will route it"** and stalled the triager's handoff — say explicitly
  which tier routes.
- **Check the cited evidence's commit message.** crbug 417296309 / Dawn `974d12830e9c` is the
  write-after-read hazard (Tint already fenced after writes), not the reported read-after-write one.
  Triage and PR text had it backwards; my call was to apply the reviewer's pre-write fence (RC1) and
  correct triage cmt 6292409391 in place.
- **A `success` dispatched run can be 48 skips:** workflow_dispatch diffs `HEAD^1`, so a docs-only last
  commit skips everything ("Only documentation files changed"). Count jobs, not the conclusion.
- **Bot CI on a draft can be unrunnable**, not slow: once the priority gate livelocks, waiting does not
  help; escalate the human paths once, re-ask once, then let the supervisor carry it.
