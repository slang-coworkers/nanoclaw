---
type: chain
title: "slang#14333 — modifier order changes SV_Barycentrics interpolation (SPIR-V + GLSL)"
description: Human-filed (pdeayton-nv, MEMBER/write) 2026-11-05 05:52:10Z, self-assigned 7 s later. I dispatched triage BEFORE the rung-4 assignee check (miss). Triaged P2 ready-for-fix 06:01Z; fixer held until 21:49Z, when the owner asked for a draft PR, then DISPATCHED (fixer sess-1793915411988-1yq16l).
tags: [slang, spirv, glsl, sv-barycentrics, interpolation, pdeayton-nv, maintainer-owned, dispatched, pr-ready]
resource: raw/triage-14333.md
---

# slang#14333 — modifier order changes `SV_Barycentrics` interpolation

**Ask.** `centroid noperspective float3 b : SV_Barycentrics` emits `BuiltIn BaryCoordKHR` on direct
SPIR-V. `noperspective centroid` emits the expected `BaryCoordNoPerspKHR`. Reported on v2026.21.

**Timeline.**
- 05:52:10Z `issue_opened`. 05:52:17Z `assigned` pdeayton-nv, actor pdeayton-nv (self-assigned, 7 s).
  pdeayton-nv has `write` permission.
- ~05:53Z I dispatched slang-triager (thread `gh-issue-shader-slang/slang-14333`) without the rung-4
  live-assignee check from [issue_opened is not evidence](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md).
  The payload has no assignee field, and the assignment came after filing. Under rung 4 this should have been held.
- 06:00–06:01Z the triager set `reproduced` + Type=Bug and posted the triage 5-bullet
  ([cmt 6650987414](https://github.com/shader-slang/slang/issues/14333#issuecomment-6650987414)).

**Triage (slang-triager's findings, ToT b3d4e7ad4; memo [raw/triage-14333.md](raw/triage-14333.md)).**
bug / medium / P2, not a regression, not a duplicate. Two barycentric selection sites read only the first
`IRInterpolationModeDecoration`: `slang-emit-spirv.cpp:8114` and `slang-ir-glsl-legalize.cpp:957`.
The global-varying copy (`glsl-legalize.cpp:1083`) reverses the list, so GLSL fails for the
*opposite* order (`noperspective centroid` → `gl_BaryCoordEXT`). The reporter's "GLSL is correct" holds only
for their order. Never worked: before #13923 (390874bbc, v2026.21) the combo was E31202. #12194 is unrelated.
Recommended A is a shared "has mode X among all decorations" helper. B (nested struct-level modifiers) is a judgment call.
Repro files: `/workspace/agent/repro-14333/` (triager container).

**Disposition: HELD, no fixer.** The issue is maintainer-owned (self-assigned MEMBER with write), the same
shape as [#13841](13841-debug-declare-real-storage.md) (same author). The triage comment stays up: it is accurate,
has no @-mentions and no Fixes link. I told the operator about the miss on 11-05.
**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned. If a fixer is authorized,
give it the triager's brief (accept criteria in the memo). No timer: webhooks deliver the resume event.

**11-05 21:49:14Z — RESUMED.** pdeayton-nv (assignee) wrote "@nv-slang-bot, please prepare a draft PR"
([cmt 6670446495](https://github.com/shader-slang/slang/issues/14333#issuecomment-6670446495); live body = payload). Dispatched
slang-fixer 21:50Z on the canonical thread with `<github-post-authorized />`, plus the triage memo as a file. Fixer session
`sess-1793915411988-1yq16l` (only fixer on the thread). Brief: option A; option B (nested modifiers) goes to pdeayton-nv as a question;
draft only, so the ready-flip waits for the human. Operator was told 11-05; no reply on the comment-removal question.

**11-05 22:43Z — DRAFT PR [#14365](https://github.com/shader-slang/slang/pull/14365)** "Select the SV_Barycentrics builtin
independent of interpolation modifier order" (`fix/issue-14333`, head 52eaec8d99, `pr: non-breaking`, `Fixes #14333`). Mapped to
fixer `1yq16l`. The fixer reported repro 24/24 (master 12/24) before the full suite ran. Explain-diff HTML received 22:53Z. Ready-flip
pending on pdeayton-nv (weekly list). Webhook-driven from here.

**11-05 22:56Z — fixer [Report].** Option A: new `hasInterpolationMode` helper (slang-ir-util), used at emit-spirv:8114 and
glsl-legalize:956. New test has 30 cases (12 fail on master). Full suite on L40S 11787/11790 (3 `fp8-cuda*` also fail on master).
Peer review was dispatched to slang-reviewer by the fixer. Option B was asked of pdeayton-nv in the explanation comment
(cmt 6671653585); the fixer proposed (a), with SPIR-V reusing the GLSL-chosen builtin name. Undecided.
**Side finds (fixer-verified on master, pre-existing):** S1 Centroid/Sample never emitted on barycentric builtins; S2 HLSL drops
`noperspective` on an `SV_Barycentrics` entry param, but not on a struct field; S3 Metal emits no no-perspective qualifier.
22:5xZ I told the fixer to dedupe and file each one (filing policy). They are FILED-ONLY: no fixer, and their issue_opened
webhooks belong to this chain, so do not dispatch them.
**11-05 23:19Z — side finds FILED by the fixer** (on master 9bbefe0ee; dedupe clean; I checked all three live as bot-authored, OPEN, unassigned):
**#14367** S1 SPIR-V Centroid/Sample not emitted (enhancement/question: the VK spec *permits* it), **#14368** S2 HLSL entry-param
modifiers dropped (DXIL InterpMode `linear`), **#14369** S3 Metal missing `center_no_perspective`. FILED-ONLY. Their issue_opened
webhooks belong to this chain, so do NOT dispatch them. Fixer go/no-go is the operator's decision, default none.
#14365 final-head suite: 11689/11796, with 107 GPU-contention OOMs. The sequential rerun gave 299/302, and the 3 failures are the
pre-existing `fp8-cuda*`. slang-reviewer pass pending (fixer-dispatched, ETA ~90 min).
**11-05 23:18Z — issue_opened webhooks for #14367/#14368/#14369 arrived** (Main sessions `ounzp1`/`lyvmie`/`l75bgk`).
I checked #14369 live: unassigned, 0 comments, no coworker session on its thread. NOT dispatched, per FILED-ONLY.
**11-05 23:37Z** — #14365 head moved to **3369e5a** (explain-diff r1 HTML received, probably review-round changes). Waiting for the fixer's [Fix Report] with the reviewer verdict.
**11-05 23:36:56Z — READY.** pdeayton-nv flipped #14365 ready and requested review (pdeayton-nv + team `dev`) at head 3369e5a755.
The `pr_ready_for_review` webhook arrived 23:38Z; NOT forwarded, because slang-pr-approver is paused. Queued in
[approver-pause-queue](../../data/approver-pause-queue.md). Operator told once. The slang-reviewer peer pass was still pending.

**11-05 23:44Z — [Fix Report]: APPROVED.** pdeayton-nv ready-flipped #14365 at 23:36:56Z and APPROVED head **3369e5a75** at 23:39:40Z
(review 5793684312; I checked it live: approval on current head; mergeStateStatus BEHIND, reviewDecision empty). slang-reviewer R1 gave
APPROVE_WITH_NITS (0 bugs; the nits were applied verbatim); Devin found 0. Merge goes to a human. CI run 42130727318.
**Option B (nested modifiers):** pdeayton-nv (cmt 6672430801) wrote: "option (b) would be best - we should align our behavior with whatever
DXC does in that case. Feel free to open a new issue for it". The fixer will check DXC and then propose, possibly as a new issue. It
stays out of #14365.
**Reviewer side find S4:** since #13923 the checker accepts `pervertex` + `centroid`/`sample`. The modifier is silently dropped under
`GetAttributeAtVertex`, and GLSL emits `pervertexEXT centroid`, which glslang rejects, for a direct read (already invalid). Low.
23:4xZ I told the fixer to file it under the filing policy: FILED-ONLY, and its issue_opened needs no dispatch.
**11-06 00:09Z — S4 FILED as [#14373](https://github.com/shader-slang/slang/issues/14373)** ("`pervertex` combined with `centroid`/`sample`
is accepted since #13923…", bot-authored, labels `Missing Diagnostic` + `reproduced`). Its issue_opened webhook reached Main session
`tfvt38`. I checked it live: OPEN, unassigned, 0 comments, and no coworker session on its thread. NOT dispatched (FILED-ONLY). Fixer go/no-go
is the operator's, default none.

**11-06 00:10Z — two more FILED by the fixer** (master 8fc11533b; dedupe clean): **#14373** S4 (`pervertex`+`centroid`/`sample`
accepted since #13923, modifier silently dropped; Missing Diagnostic) and **#14374** nested-modifier rule per pdeayton-nv's DXC
direction (a field's own modifiers replace the parameter's, and a field with none inherits; Metal/WGSL don't inherit, and GLSL picks the
barycentric builtin from `noperspective` at any level). FILED-ONLY, and their issue_opened needs no dispatch. Fixer posted on #14365:
cmt 6672511124 and 6672919976. Chain state: #14365 approved + ready, merge goes to a human. Nothing pending from the bot.
**11-06 00:09Z — #14374 issue_opened webhook** reached Main session `xz2zpd`. I checked it live: OPEN, unassigned, 0 comments, and no
coworker session on its thread. NOT dispatched (FILED-ONLY). Fixing option B needs pdeayton-nv's or the operator's go-ahead.
