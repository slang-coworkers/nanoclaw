---
type: project
name: project_13771_metal_rwtexture_fence
description: "slang#13771 (albertrodriguezclo, external, 10-20 13:13Z): Metal never emits texture.fence() between a same-thread write and read of an access::read_write texture (MSL 4.1 §6.13.17). Triaged bug/medium/P2 13:49Z; Approach A (fence after every read_write write, a Metal IR pass after legalizeImageSubscript). Handed to slang-fixer 13:54Z (session i4wuxx, triager edge). Reporter declined the fix 14:20Z. DRAFT PR #13792 @85e57b862 20:39Z (pr-mapping → i4wuxx); R1 regression fixed 22:11Z, head 1705cc5 (still draft). Head 59ac5030a1 22:29Z; real-matrix run 39507383213 YIELDED at priority gate (waiting). Fixer one-shot re-check 10-21 04:30Z; if still yielding → human must prioritize one macOS run. Reporter blocks leaving draft on green macOS metallib. R1 REQUEST_CHANGES → R2 01:48Z APPROVE_WITH_NITS @bd3444ec43 (nits, no R3). R2 nits applied @accfd0d97f 02:01Z. PARKED ON OPERATOR: run 39530615997 waiting (priority gate + falcor-ci); human dispatch or approved ready-flip needed. Re-check task rechase-13771-pr13792-ci 10-21 14:00Z."
---

# slang#13771: Metal RWTexture write→read needs `fence()`

**10-20 13:13Z `issue_opened`**, external reporter (same person as #13633/#13753/#13774/slangpy#1232). Routed to `slang-triager`
on `gh-issue-shader-slang/slang-13771` (triager session `sess-1792502067447-0onhoa`; my webhook session `sess-1792502009853-1i67fs`).

**Triage (13:49Z, cmt [6292409391](https://github.com/shader-slang/slang/issues/13771#issuecomment-6292409391)):** bug, medium, P2,
Metal emit, not a regression. Label `reproduced` + Type=Bug. Memo at `/workspace/inbox/a2a-1792504245586-kkut7u/triage-13771.md`,
scratch at `/workspace/agent/scratch-13771/`. The gap is wider than reported: `RWBuffer` (string intrinsic setter), callee write →
caller read, ROV, texture atomics, and Slang's own `legalizeImageSubscript` RMW (`img[p].x=..; img[p].y=..` → write, read, write).
Hardware evidence: Dawn crbug 417296309 (Apple Silicon). Prior art: Tint fences before+after each store; SPIRV-Cross before each read.

**I verified at origin/master 7251cc60b4:** `hlsl.meta.slang:20672` (`case metal: __intrinsic_asm "$0.write($2, $1)"`),
`slang-emit-metal.cpp:1043/1062` (ImageLoad/ImageStore), `slang-emit.cpp:2413` legalizeIRForMetal before `:2474` legalizeImageSubscript,
and zero `fence` in slang-emit-metal.cpp / slang-ir-metal-legalize.cpp.

**Approach A:** a new fence IR op, inserted by a Metal pass after legalizeImageSubscript after each write to a read_write-class
texture (ImageStore, RWBuffer setter moved onto ImageStore, texture atomics); emitted as `<tex>.fence()`. Open for the maintainer: Tint's
pre-write fence (WAR), an opt-out flag, the atomic fence, `.fence()` on textures in KernelContext/`constant` structs (Tint const_cast).

**Ownership:** the triager held its fixer handoff because my "send one report" message read as if I would route it. At 13:50Z the reporter
had no claim or PR (the timeline shows only the bot's label/type/comment). Their precedent: #13766 → own PR #13775 27 min after filing;
#13753 → own PR #13755 and our fixer stood down. I approved the triager's normal handoff to slang-fixer (fixer stays on the triager's
edge, as with #13774), with a guard: before opening a PR and before each push, re-read #13771 + the reporter's open PRs; if they claim
or open one, stand down without pushing and report up. Conflict note: reporter's open #13755 also edits slang-emit-metal.cpp (AnyValue
handle casts, a different area).

**13:54Z:** fixer session `sess-1792504449151-i4wuxx` created on the triager's edge (`epsn3s`). It is the only fixer session.

**14:20Z reporter cmt [6293057817](https://github.com/shader-slang/slang/issues/13771#issuecomment-6293057817):** "I'm not going to take this
one, so the automated fixer can go ahead with approach A." They have no Mac, and they offered to review the draft and try it in their Metal
path once it is up. The reporter guard is satisfied, so there is no stand-down risk. I relayed the comment verbatim to the triager on
`-13771` for the fixer: ping the reporter on the draft.

**20:56Z: DRAFT PR [#13792](https://github.com/shader-slang/slang/pull/13792)** (`fix/issue-13771`, head 85e57b862, +197/−3, 12 files,
`pr: non-breaking`, `Fixes #13771`). I checked this live: the pr-mapping row → `i4wuxx` (20:39Z), and the issue update is
cmt [6301290345](https://github.com/shader-slang/slang/issues/13771#issuecomment-6301290345). It is Approach A: a `metalTextureFence` op inserted after
legalizeImageSubscript, printed as a by-value `_slang_textureFence(tex)` prelude helper (avoids the const-member problem); RWBuffer
setter moved onto ImageStore. **#13755 overlap is clear:** I checked hunks myself; #13792 touches emit-metal.cpp only at −1075 and .h at −133, while #13755 touches
−142/−710/−881/−893 and .h −89.
Triager's findings (not mine): new test fails on master; fixer reports the suite at 10955/10958 (3 fp8 CUDA failures, also on master); no Apple compile/run
(metallib lines are macOS-CI only). **Open:** the triager asked the fixer to recheck its claim that master copies a texture array to a local
when an element is used twice. The triager sees no such copy on master (`scratch-13771/ua*.slang`). If the PR introduces it, an unsized `arr[]`
would give invalid MSL, a regression. Next: reviewer R1 → `[Fix Report]` → `[Triage Resolution]`. If a `pr_ready_for_review` webhook arrives, check approver `paused` first.

**21:04Z: regression in #13792 @85e57b8, confirmed by the fixer (the triager's finding).** A write or texture atomic in a callee, and a sized array after
the KernelContext, now copy the whole texture-handle array to a local first. That is invalid MSL for an unsized `arr[]`, and master does not do it.
Cause: the fence op is a second use of `getElement(load(kc.arr), i)`, and `simplifyForEmit` (slang-ir-simplify-for-emit.cpp:136) will not sink the load past the store.
**I verified at origin/master:** `canInstHaveSideEffectAtAddress` (slang-ir-util.cpp:1622) has cases only for Store/SwizzledStore/Call/branch/casts.
ImageStore and texture atomics fall to the `default: mightHaveSideEffects()` path. The other callers are redundancy-removal :573/:615/:688 (all targets).
Fixer's plan (relayed by the triager): add a narrow case for ImageStore, since it writes texels and no IR address, and alias-check atomics through their `ImageSubscript`. Then run the full suite.
Fallback: print the fence inline in the write's emit case. Plus regression tests for the unsized callee write and the atomic. The PR description must justify the shared-helper change in its process report.

**22:11Z: regression fixed, head 1705cc56a** (7 commits, no force-push). 2604cf7 adds the `canInstHaveSideEffectAtAddress` case: a texel write cannot
change an address that holds resources (`isResourceType`). f945cb7 adds the loop test and `tests/spirv/texture-array-texel-write.slang`
(SPIR-V/GLSL/HLSL byte-identical, fixer-reported). 1705cc5 is the docs-only same-thread note. The PR body's Risk line names the all-target alias change.
**Reporter PR cmt [6302260803](https://github.com/shader-slang/slang/pull/13792#issuecomment-6302260803)** (I read it): they built 2604cf7 on Windows and say "approach looks right".
Their only blocking ask is a green macOS run before it leaves draft, because METALLIB lines are the sole check that Apple accepts `fence()` on texture_buffer, ROV and `_slang_textureFence`.
Their cost point (drop unneeded fences) is a follow-up. They also corrected their own issue text: only the Device and All barriers carry `mem_texture`.
**CI, verified by me:** dispatched run 39505661665 @1705cc5 shows `success` but has 2 success / 48 skipped. The filter log says "Only documentation files changed, skipping".
Cause: workflow_dispatch diffs `HEAD^1`, and the last commit is docs-only. This is the known trap (learnings 1792172198845 and 1791961955700).
The earlier runs, 39501036439 @2604cf7 and 39493826359 @85e57b8, were cancelled. So no build/test has run on any head. I flagged it to the triager at 22:1xZ.

**22:29Z: head 59ac5030a1** (test-only ARRAY lane: callee writes sized `tiles[4]`; metallib lines cover array-element fence). I verified run
**39507383213** @59ac503 (workflow_dispatch): filter success (should-run=true), `wait-for-human-priority` failure (yielded), status `waiting`,
1 success / 2 failure / 44 skipped / 1 pending. Still no build/test on any head. **Timer:** fixer's one-shot re-check at 2026-10-21T04:30Z
(fixer-owned, not mine). If it is still yielding then, the triager raises a blocker → I tell the operator a human must prioritize one macOS run.

**23:41Z: slang-reviewer R1 = REQUEST_CHANGES** (0 bugs / 3 gaps / 4 nits; session `ex68mp`, dispatched by the fixer; the fixer received it at seq 38). Combined report:
`/workspace/inbox/a2a-1792539656738-9ycey3/combined-review-13792-r1.md`. Nothing was posted to GitHub.
- **RC1 (top): write-after-read is unfenced.** I checked the Dawn commit 974d12830e9c message: its title is "[msl] Insert a fence before writes to read-write storage
  textures", and it says "We were already inserting fences after writes". So **crbug 417296309 was the WAR hazard**, seen while Tint already fenced after
  writes (this PR's design). The triage comment and the PR explanation both cite it as RAW evidence, which is wrong. The reviewer's patch adds a pre-write fence, placed for atomics
  before the ImageSubscript chain (dominance). With it, tests/metal is 222/223 (one CHECK-NEXT needs updating).
- RC2: the RWBuffer setter now pads to 4 components (`uint2` → `uint4(...,0,0)`); probably a quiet MSL fix, but no test pins it. RC3: 5 of 6 NOFENCE-NOT lines are vacuous.
- Keep the alias-query change: the revert drill fails, and 156 files show 0 non-Metal diffs.
- **Out of scope, pre-existing:** `RasterizerOrderedBuffer<float>` is emitted as `texture_buffer<..., access::write>` but `read()` is called on it, which is probably invalid MSL (`kBaseBufferAccessLevels`). I asked the triager to own the dup-check and filing.
- **My call (Orchestrator):** apply RC1. The triage's "maintainer call, don't add by default" assumed the wrong crbug attribution. Put the cost in the PR Risk line. Triager to correct cmt 6292409391.

**23:58Z:** the triager passed RC1 to the fixer (msg 45), corrected triage cmt 6292409391 in place (the crbug is the WAR test; Approach A now fences before and after,
about 2 per write), and refreshed status cmt 6301290345. Nuance: Dawn says both new tests fail on M1 without fences, so both hazards are real; the crbug is the WAR one.
**Spin-off [#13796](https://github.com/shader-slang/slang/issues/13796)** (bot-filed 23:51Z, `regression`+`reproduced`, Type=Bug): `RasterizerOrderedBuffer<T>`
is write-only on every target, a regression from #5454. I verified this on master: `hlsl.meta.slang:20562-20569` passes the loop index `aa` as the `_Texture`
access argument. `kBaseBufferAccessLevels` has 3 rows (READ/RW/RasterizerOrdered), so ROB gets aa=2 = `kCoreModule_ResourceAccessWriteOnly`
(slang-type-system-shared.h:101; RasterizerOrdered is 3). **Its own chain:** sibling Main `sess-1792540289870-fun2vl` on `-13796` got the
issue_opened webhook and owns the routing. I told the #13771 triager not to hand it off from this thread. Interaction: once #13796 is fixed, ROB buffers become
non-write-only, so #13792's ImageStore path fences them automatically.

**10-21 01:48Z: R2 = APPROVE_WITH_NITS @bd3444ec43** (the fixer has it at seq 66; report at `/workspace/inbox/a2a-1792547319249-802x7y/combined-review-13792-r2.md`).
RC1–RC3 met, with mutation drills: removing the leading fence fails 5 lanes. The PR merges cleanly onto origin/master 8896a5102. Nits, applied without an R3:
- the ROB doc row must show the real `access::write` output and link #13796;
- comments still say "after" only;
- tighten the tests;
- add a ParameterBlock texture-atomic lane;
- state that only the trailing fence is in the MSL spec, and that the leading fence comes from hardware (Dawn, M1).
The reviewer could not reproduce Devin's "pointer-backed texture atomic abort" (0/465 compiles). The fixer's 04:30Z timer still applies.
**CI, verified by me:** 39507383213 @59ac503 was cancelled (superseded). 39521173251 @bd3444e is `waiting` (yielded). No build or test has run on any head.
After the Fix Report, the only open item is that a human prioritizes the macOS run.

**01:5xZ: CI will not clear on its own. I checked this myself.** The retry workflow (`CI Retry Yielded Bot`, id 304423273) last ran 01:36Z and logged
"CI is still active (85 run(s)); not rerunning bot CI." ci.yml has 80 `waiting` runs (66 bot workflow_dispatch, mostly parked on `falcor-ci`
pending deployments, 39521173251 included), plus 3 in_progress and 2 queued. `waiting` ∈ `ACTIVE_STATUSES` (ci_priority_common.py:29) → livelock
(see [[feedback_a_status_set_broader_than_its_docstring_livelocks_the_throttle]]). A bot rerun or dispatch re-enters the gate:
`IS_THROTTLED_BOT` = workflow_dispatch && triggering_actor==nv-slang-bot[bot] (ci.yml:101). **Human paths:** a human `gh workflow run ci.yml
--ref fix/issue-13771` (the head commit must touch non-doc files), or the operator approves a ready-flip (pull_request CI runs at full priority, but the reporter wants macOS
green first). Plan: once the nit push lands and its run id is known, I escalate one ask to the operator. Told the triager not to wait for 04:30Z.

**02:01Z: R2 nits applied, head accfd0d97f** (I verified: the head commit touches only metal-legalize.cpp and the two tests, MERGEABLE, still a draft). Run **39530615997**
(workflow_dispatch) is `waiting`: filter success, `wait-for-human-priority` failed (yielded), pending deployment `falcor-ci`, 44 skipped. **Escalated to the
operator on orchestrator-dashboard at about 02:05Z** with two options: (1) a human dispatches `ci.yml` on `fix/issue-13771` (full priority, not throttled), or (2) the operator
approves a ready-flip of #13792 (pull_request CI). Also offered approving the `falcor-ci` gate. **Timer:** one-shot `rechase-13771-pr13792-ci` at
2026-10-21T14:00Z (decision table inside). Fixer [Fix Report] and triager [Triage Resolution] are still pending.

**02:15Z [Triage Resolution]** from the triager: fixed in draft #13792 @accfd0d97f (13 commits, no GitHub reviews yet), on hold for the operator's CI decision.
Follow-ups outside the PR: shared texel-atomic helper, HLSL/GLSL alias-query test, redundant-fence removal, #13796 (own session). Coworker tiers are
holding: the fixer and triager will neither re-dispatch nor mark it ready. The triager checks the macOS logs (`Metal: not supported`) when a real run lands.
Escalation sent to orchestrator-dashboard at 02:1xZ (3 options: human dispatch / approved ready-flip / `falcor-ci` approval). Timer `rechase-13771-pr13792-ci-c32d` is set for 14:00Z.
