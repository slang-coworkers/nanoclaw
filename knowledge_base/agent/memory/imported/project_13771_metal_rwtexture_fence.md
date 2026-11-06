---
type: project
name: project_13771_metal_rwtexture_fence
description: "TERMINAL 11-06. slang#13771 (albertrodriguezclo, external): Metal never emitted texture.fence() on access::read_write textures. FIXED by PR #13792 (fence before+after every texel write; WAR fence added on reviewer RC1), MERGED by jkwak-work 11-06 02:12:49Z (merge 286cdeee49); issue auto-closed COMPLETED. Hardware-confirmed on M4 by reporter; project macOS CI 8/8 green. Follow-up #13796 (ROB buffer write-only) owns its own chain."
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

**10-29 11:16Z: hardware confirmation.** Reporter cmt [6494314161](https://github.com/shader-slang/slang/pull/13792#issuecomment-6494314161), which I read: they ran it on an Apple M4,
macOS 26.7.1, Xcode 26.5, comparing PR accfd0d with control 7251cc6. Results:
- Runtime wrong components went to 0 under the PR: rawOnce 209.6M, rawChain 194.8M, war 4.8M (~2.3%) on control. The WAR row backs the RC1 decision; no post-fence-only variant was tested.
- `-api mtl` full suite: 5487/5583 vs 5481/5583, with no regressions.
- The only new failure is the PR's own METALLIB lane `.5`: "number of textures with read_write access exceeds maximum supported (8)". `computeMain` had 11 rw textures, so the test is at fault, not the codegen.

The fixer pushed `1cbdeb683d` (merge master) and `18cc8ac929` (a separate `metallibMain` with ≤8 rw textures), with no rebase.
I verified `k_maxSupportedModuleVersion` 37→38 in the diff, MERGEABLE, draft, 0 reviews. CI 40862424323 @18cc8ac `waiting` (yielded, 40 skipped).
**Lesson:** the reporter said "no Mac here" on 10-20, yet produced M4 results on 10-29. An external contributor's constraint can change; a direct ask (the fixer's) got the hardware run that our CI could not.
Next: the reporter re-runs the 2 metallib lanes on 18cc8ac, or a human dispatches CI. Then the operator decides the ready-flip. I sent one update to the dashboard 10-29.

**10-29 11:41Z: reporter re-ran 18cc8ac on the M4** (cmt [6495681400](https://github.com/shader-slang/slang/pull/13792#issuecomment-6495681400); I read it). Results:
- 8/8 `read-write-texture-fence*` lanes pass, including `.5` METALLIB (`metallibMain`) and `.6` METALLIB_ROV.
- `xcrun metal -c` is clean apart from one -Wunused-variable on the atomic result, and `slangc -target metallib` works for both entries.
- Runtime repro still shows 0 bad components.

The fixer made no code change and only updated the Tests line and explanation (cmt 6495788612). The reporter's own pre-ready condition is met.
Project macOS CI (run 40862424323) still yielded. At 11:5xZ I told the dashboard that the condition from my 11:2x ask is now met: approve the ready-flip.

**11-05 19:12Z: the maintainer took the decision.** jkwak-work marked #13792 **ready for review** (event 19:12:39Z) and left a COMMENTED review
(19:12:27Z) with 8 inline comments and a request to resolve conflicts. I checked: `CONFLICTING`, review requests to kaizhangNV + `dev` team, head still
18cc8ac929. The fixer merged master locally (stable name 910, writer version 39), applied all 8 comments and is rebuilding, ~25 min, not pushed yet.
**Operator decision resolved and moot.** I removed it from supervisor-state `_meta.operator_decisions` and the weekly ready-flip list, added a `_operatorDecisionsPending.resolved` row, and set the chain to `in_review`.
I told the triager that the fixer must not "re-request review" ([[feedback_fixers_cannot_request_reviewers]] is in the root store): it should @-mention jkwak-work in a PR comment after the push.
The PR is now non-draft, so check approver `paused` before any approver routing.

**11-05 20:10Z: head 1c506c7adf**, checked by me. Non-draft, MERGEABLE, mergeStateStatus BLOCKED. The fixer's reply cmt 6668082639 (20:08:13Z) @-mentions jkwak-work
and answers all 8 comments. R4 (the pass is a `static` in slang-emit.cpp) and R7 (non-resource addresses keep `mightHaveSideEffects()`) differ from the literal ask, with explanations.
Review was not re-requested. **CI:** `pull_request` run 42098539613 started on its own. At my check it had 16 success / 21 pending, and the macOS build release and static-unit-test
jobs had succeeded. `test-macos-release-clang-aarch64` (the metallib lanes) was pending. This is the first project macOS run on any head.
The triager will grep `Metal: not supported` and report the result, or the merge.

**11-05 23:32Z: APPROVED.** jkwak-work APPROVED at 23:20:06Z (review 5793537950). The head is **446b21c719**: merge `cd03cd381` brings in #14210, and `446b21c` uses
`getAtomicImageSubscript`. The fixer reports the MSL is byte-identical. I checked run 42098539613 @1c506c7: it shows `cancelled` because a newer head superseded it, but **all 8 macOS jobs
succeeded**, including test-macos-release/debug test-slang. Triager's finding from the log: "Check mtl,metal: Supported", all 8 fence lanes pass, 8099/8099.
Now MERGEABLE/BLOCKED, with CI 42128079212 @446b21c running (21 success / 18 pending). Remaining human steps: the `falcor-ci` gate and the maintainer's merge.
The triager closes out on merge. **Lesson:** a draft parked 2 weeks on an unanswered operator CI ask moved within hours once a maintainer flipped it ready.
The `pull_request` CI then ran macOS on its own, because the throttle only applies to bot workflow_dispatch runs.

**11-06 00:5xZ: `pr_ready_for_review` (synchronize) webhook for #13792 reached Main.** slang-pr-approver is `paused=1`, so it was NOT forwarded; queued in
[`data/approver-pause-queue.md`](../../data/approver-pause-queue.md) and noted once on the dashboard. Live @446b21c719: MERGEABLE/BLOCKED, check-runs 56 success / 4 skipped / 1 in_progress.
Later events for #13792 get the `paused` check only — no new queue edit, no new dashboard line.

**11-06 02:15Z: TERMINAL.** #13792 was MERGED by jkwak-work at 02:12:49Z (merge `286cdeee49`, head 446b21c), and #13771 was CLOSED COMPLETED at 02:12:50Z. I checked both.
The triager edited status cmt 6301290345 to final, removed sentinel `active-work/shader-slang-slang-13771`, and filed a learning on the draft-PR macOS CI trap.
Final CI 42128079212 @446b21c had no conclusion when it merged (falcor gate). Follow-ups elsewhere: #13796 (ROB buffers stay unfenced until it lands); optional redundant-fence
removal, an HLSL/GLSL alias-query test, a shared texel-atomic helper. Supervisor-state is set to `closed_merged`. Closure note sent to the dashboard.
