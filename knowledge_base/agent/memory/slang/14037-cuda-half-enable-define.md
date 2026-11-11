---
type: chain
title: slang#14037 — `-target cuda` source using `half` needs a manual `-DSLANG_CUDA_ENABLE_HALF` for nvcc
description: Human-filed (albertrodriguezclo) bug 2026-10-29 17:10:21Z, cloth-sim batch. Triaged bug/medium/P2, reproduced (nvcc 12.6, sm_89). Fixed by slang-fixer (approach A); DRAFT PR #14194 (head baef466b5, R2 approve-with-nits, nits applied) waits on a maintainer to apply the CI-workflow hunk and on the operator to un-draft; 11-09 re-check found an unanswered reporter comment, fixer dispatched. Triage comment 6583466378.
tags: [cuda, prelude, half, emit, r6, 14196, 14199]
---

# slang#14037 — CUDA source output does not define `SLANG_CUDA_ENABLE_HALF`

**Ask.** `slangc -target cuda` on a module that uses `half` succeeds, but `nvcc -cubin` on the output fails
(`__half` / `F16_max` undefined) because the prelude includes `<cuda_fp16.h>` only under
`#ifdef SLANG_CUDA_ENABLE_HALF`. The NVRTC path (`-target ptx`) passes the define itself. Expected: emit
`#define SLANG_CUDA_ENABLE_HALF 1` before the prelude include when the module uses `half`, as
`-fp-mode fast` already does for `SLANG_CUDA_ENABLE_FAST_MATH`. These are the reporter's claims; not reproduced by me.

**GitHub state (verified 10-29 at dispatch).** 0 comments, no labels.
**R6:** no `bot-ok`, no crash word (`error: identifier ... undefined` is an nvcc diagnostic, not a crash),
so the bot holds any comment until `created_at`+4 d = **2026-11-02 17:10:21Z**.

**Related.** #14029, #14033 (CUDA prelude / host header, same batch).

**Triage (slang-triager, 10-29 17:35Z, master 9b3ac252d) — its findings; I spot-checked the emitter/prelude lines only.**
- Reproduced; `-target ptx` builds. Type=Bug + `reproduced` label set (no comment).
- Root cause: `m_extensionTracker` already records half/bf16/fp8 use, but only the NVRTC path turns it into `-D` defines
  (slang-code-gen.cpp:586-597); `CUDASourceEmitter::emitFrontMatterImpl` (slang-emit-cuda.cpp:401-411) writes only FAST_MATH.
  docs/cuda-target.md:263 already promises the define.
- Wider than reported: BF16 and FP8 have the same gap, and prelude:746 gates `SLANG_MAKE_VECTOR` on `RTC || HALF` only, so
  `-DSLANG_CUDA_ENABLE_BF16`/`_FP8` alone still fails under nvcc.
- Memo: `/workspace/inbox/a2a-1793295333014-d66nk4/triage-14037.md`.

**Routing decision (Main, 10-29).** Fixer, approach A, one PR (all three defines + the :746 gate; the same mechanism and
function, so splitting would leave a known gap). Following the #14032 precedent, **nothing may touch #14037's timeline
while R6 holds**: no comment, no pushed commit or PR referencing it. The fixer prepares locally now and opens the draft
PR from a one-shot after 11-02 17:10:21Z, standing down if a human commented, self-assigned or opened a PR in the meantime.

**Timers.** Triager `t-8bb71d` 11-02 17:15Z posts the triage comment ("handed to slang-fixer, fix incoming"). Its skip conditions were aligned with the fixer's at 10-29 17:40Z:
if, after 10-29 17:35Z, there is a human comment (the reporter counts), an assignee or a human PR (drafts count), it stands down and reports; with a newcomer label it never posts.
The fixer's push/PR one-shot runs after it (≥17:45Z).

**Fix ready locally (slang-fixer, 10-29 19:01Z — its figures, not re-run by me).** `fix/issue-14037` @ base 63f45a662,
worktree `/workspace/agent/wt-slang-14037`, 4 commits, +101/−3. The prelude makes `SLANG_MAKE_VECTOR` unconditional instead of widening :746.
It reports: new test 8/8 (fails on master); nvcc sm_89 without `-D` builds the repro, bf16-only and fp8-only modules;
`tests/cuda/` 147/147 on the L40S. 3 `tests/cooperative-matrix/fp8-cuda*` failures (`CUDA_ERROR_INVALID_PTX`) fail the same with the change reverted,
so they are pre-existing on this GPU. The same class was seen on #14013.
Push/PR one-shot **`slang-14037-r6-push-7218`** 11-02 17:45Z; handoff `/workspace/agent/reports/slang-14037-handoff.md`.

**Decisions (Main, 10-29).**
- `bot` label: the label does not exist (only `bot-ok`). R9's labeling workflow #13588 is still a draft, and the gap was flagged to the operator 10-29 (#14032).
  So: apply `bot` if it exists at fire time, otherwise omit it and proceed. No label is created by the bot. The `bot` label in my dispatch was my own addition.
- Accepted with disclosure in the PR body: losing NVRTC `-pch` for half/bf16/fp8 on `-target ptx` (same as FAST_MATH; follow-up, not in this PR),
  and no CI coverage of the prelude gate change (verified by hand with nvcc).

**11-02 17:15:36Z — triage comment posted** by t-8bb71d: nv-slang-bot comment 6583466378 (Main verified; the issue then had 1 comment,
label `reproduced`, no assignee). There was no stand-down trigger. The triager edits that comment in place when the PR arrives.

**11-02 17:59Z — DRAFT PR #14194** `fix/issue-14037` @ 930cdba88 (Main verified): body has `Fixes #14037` (closingIssuesReferences=[14037]),
label `pr: non-breaking` only (`bot` still does not exist; only `bot-ok`). Explanation comment posted at 18:02Z (explain-diff-html marker, head 930cdba88266).
Draft CI: 53 skipping, 3 pass, 1 pending.
⚠️ **The PR mapping points at the fixer's one-shot task session** `sess-1793299737852-j9up0v` (thread `system:tasks:slang-14037-r6-push-7218`), not
its chain session on `gh-issue-shader-slang/slang-14037`. That is first-claim-wins, so PR webhooks wake the task session; it read the handoff file.
A remap is an approval-gated operator action. I did not request one.

**11-02 18:11Z fixer `[Report]`.** The stand-down check was clean twice. The merge of master 8229f2742 was clean, and the diff vs master is unchanged (+101/−3).
Its figures: focused 13/13, `tests/cuda/` 150/150 on the L40S. Repo automation auto-assigned **jkwak-work** as shepherd/reviewer; the bot did not request anyone.
CI run 41496259232 (Main verified) is in the **priority-yield gate**: `wait-for-human-priority` + `check-ci` failed, 40 skipped, `falcor-build-approval-gate`
is waiting on env `falcor-ci` (`current_user_can_approve:false`). This is the intended gate for a draft bot PR; show it, never nudge it (same as #14014/#13771).
`[Fix Review Request]` sent to slang-reviewer.

**11-02 18:38Z slang-reviewer R1 = REQUEST_CHANGES** (head 930cdba88; memo `/workspace/inbox/a2a-1793644700077-isz0df/combined-review.md`, patches in its run dir). These are its findings; I read the memo, not the drills.
- **B1 🔴** fp8-only `-target cuda` output fails `nvcc -c`: `Fp8MMAHelper<…, half, …>` needs `RegisterCount<half,…>`, which sits only under HALF (prelude ~8909 vs ~7047).
  The fixer's "fp8 rc 0" was measured with `-cubin` only. Fix: a one-gate patch.
- **G1** gate the defines off for `CodeGenTarget::PTX`, because NVRTC already gets `-D`. This keeps `-pch`.
- **G2** add a `cuda-prelude-single-type.cu` fixture, compiled 3× in the existing Windows nvcc CI step.
- Full suite 11152/11155 (the 3 known fp8-cuda failures). Side find: an `m_fp8FoundPaths`/`m_bf16FoundPaths` copy-paste (slang-nvrtc-compiler.cpp:1132).
- **Main decision 11-02:** G1 and G2 go into this PR. This supersedes my 10-29 "`-pch` = follow-up" and "don't touch ci-slang-test.yml": B1 slipped through exactly because there was no nvcc CI coverage.
  The side find goes to the triager to file (verified + deduped → no operator gate).

**11-02 18:44Z side find filed as #14196** by slang-triager: "NVRTC: cuda_bf16.h directory is cached as an fp8 directory". Type=Bug, labels `reproduced` and `cuda`.
The triager confirmed it at run time with a stat shim; there is no fixer chain. **The #14196 `issue_opened` webhook is bot-filed and owned by this chain: dispatch nothing.**
It arrived in Main on 11-02 and was not dispatched (checked against this record).
**11-05 the operator asked (dashboard msg 26) for a #14196 triage verdict.** I answered from the triager's filing plus a live check, with no new dispatch: subsystem compiler-core NVRTC downstream (`slang-nvrtc-compiler.cpp`), Bug, low/P3, and line 1132 is still wrong on master.
It is **held under rung 4**: jkwak-work self-assigned it at 11-02 18:45:24Z (97 s after filing) and set milestone Q1 2027. No PR, no comments. A bot fix needs the operator's go and jkwak-work's hand-back.

**11-02 19:12Z R1 applied** (Main verified head 5646c2ab9, still a draft; 5 files incl. the new `tests/cuda/cuda-prelude-single-type.cu`). B1, G1 and N1–N4 are pushed.
For N1 the fixer dropped the `#ifndef` guard: plain `#define X 1`, like FAST_MATH. Its L40S figures: 319/322 and nvcc `-c`/`-cubin` 8/8.
**G2's `ci-slang-test.yml` step was rejected** (the App has no `workflows` permission; durable, see
[../imported/project_bot_workflows_permission.md](../imported/project_bot_workflows_permission.md), not an outage). The hunk is in the explanation comment and in
`/workspace/agent/patches/fix-14037-ci-step.patch`; the PR body names it as an open question. A maintainer (jkwak-work is the shepherd) must apply it, and it blocks merge, not review.
CI run 41505696051. R2 review was requested from slang-reviewer.

**11-02 19:47Z slang-reviewer R2 = APPROVE_WITH_NITS** (head 5646c2ab9; memo `/workspace/inbox/a2a-1793648821872-q5cu98/combined-review.md`): 0 bugs, 1 gap, 4 nits.
Its figures: B1 and G1 verified fixed, nvcc 18/18, full suite 11152/11155. The nits: a mixed-type test lane (a mutation drill showed it missing), fixture asserts, PTX-gate scoping, docs `-arch` floors. Nothing was posted.

**11-02 20:03Z `[Fix Report]`** (Main verified head baef466b5, a draft, 5 files +139/−3, explanation comment 6584453646 at head baef466b51ca). The R2 nits are applied, including the MIXED lane.
Its figures: 320/323 (3 known fp8-cuda failures). CI run 41514318184. Second side find (reviewer → fixer → Main): `slangc -target cubin` gives E99997 "unhandled code generation target"
although `-h target` lists cubin. It was sent to the triager to verify, dedup and file, under the same no-fixer-chain rule as #14196.
→ **Filed as #14199** at 11-02 20:09Z (Type=Bug, labels `reproduced` and `cuda`). Per the triager, the target was never implemented: #2708 added only the enum and the help entry.
The issue offers the maintainers implement-or-remove. **The #14199 `issue_opened` webhook is bot-filed and owned by this chain: dispatch nothing.**
It arrived in Main on 11-02 and was not dispatched (checked against this record).
**11-04 17:09Z jkwak-work self-assigned #14199 and milestoned it Q1 2027 (Winter)** (Main verified 11-05; 0 comments). It is now maintainer-held (rung 4): the bot posts nothing
and dispatches nothing unless jkwak-work asks. On 11-05 the dashboard asked for triage; Main answered from the filed body plus the live state, with no new dispatch.

**11-02 20:04Z `[Triage Resolution]`**: issue comment 6583466378 was edited in place to "Fix in draft PR #14194, held for review and approval"; it names the workflows-permission blocker.

**Next.** The R2 nits are done. The remaining steps are human: a maintainer commits `fix-14037-ci-step.patch` (`workflows` permission), and the operator un-drafts; the triager edits comment 6583466378 for the PR. Un-drafting is the operator's call (drafts-only).
Owners: slang-fixer (PR), slang-triager (issue comment), thread `gh-issue-shader-slang/slang-14037`.

**11-09 15:00Z re-check (`i14194-recheck-4c40`, Main verified live).** Not merged; still a draft at head baef466b5 with no new commits.
`ci-slang-test.yml` is still not in the diff (5 files). There are 0 reviews, and jkwak-work is assigned with a pending review request. All three human steps are still open.
**Human activity:** the reporter albertrodriguezclo commented on the PR at 11-06 22:51:58Z (comment 6697789987). They endorse the approach, ask a maintainer with `workflows` access to add the nvcc step, and will report a plain-nvcc build of their `law<half>` repro.
Nobody answered it, because the PR mapping owner `j9up0v` is **closed**, so the comment woke no fixer session.
→ I dispatched slang-fixer (row 19) on `gh-issue-shader-slang/slang-14037`, pinned to its chain session `sess-1793295441468-63xfrp` with `in_reply_to=2`; it landed as row 68 at 15:02:54Z.
The ask: one reply to the reporter that points at the patch. No code, no reviewer request, no ready-flip. Per the decision table, there was no dashboard message (human activity, so row 2 applies).
⚠️ Later PR webhooks still route to the closed `j9up0v`. An operator `pr-mappings remap` to `63xfrp` would fix that, and it is approval-gated. Not requested.

**11-09 15:06Z — the fixer replied to the reporter**: comment 6743388746 (Main verified). It asks for their plain-nvcc results and says the CI step needs a maintainer with `workflows` permission.
It links the hunk in explanation comment 6584453646. **The PR mapping is fixed:** the fixer's `report_pr_created` re-pointed #14194 to its chain session
`sess-1793295441468-63xfrp` (thread `gh-issue-shader-slang/slang-14037`, Main verified 15:06Z), so the closed-`j9up0v` problem is gone and no remap is needed.

**Next.** The steps still waiting on humans are the workflow hunk (a maintainer), review (jkwak-work), and the un-draft (the operator, on the weekly ready-flip list).
No new timer is set: the reporter's nvcc report and any maintainer action arrive as comments on this PR.

**11-10 (tick 337) — #14194 pr-mapping now points to fixer `sess-1793295441468-63xfrp`** (`ncl pr-mappings list
--limit 10000`), no longer the closed task session `j9up0v`. Operator row "approve remap" resolved; webhooks route to
the fixer again.
