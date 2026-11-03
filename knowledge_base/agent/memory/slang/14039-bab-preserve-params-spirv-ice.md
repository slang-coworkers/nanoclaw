---
type: chain
title: slang#14039 — unused ByteAddressBuffer + -preserve-params ICEs in spirv-emit
description: Human bug (pdeayton-nv, `bot-ok`) 2026-10-29. Fixed by bot PR #14045, MERGED 2026-11-02 19:50:24Z (merge commit 2518a942d); the issue closed as completed. Terminal record.
tags: [spirv, byte-address-buffer, legalization, preserve-params, bug, merged, closed]
---

# slang#14039 — unused BAB with -preserve-params → spirv-emit ICE

**Repro.** `ByteAddressBuffer unusedBuffer;` plus an empty compute `main`, compiled with
`slangc -target spirv -preserve-params -O0`, gives E99997 "Unhandled global inst in spirv-emit: … = ByteAddressBuffer".

**R6.** The issue is exempt (`bot-ok`, and also a crash word plus a fence), so posting at once was correct.

**Triage (slang-triager, 10-29 17:48Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
The ICE also fails on 2026.13.1, so this is not a regression.
`legalizeByteAddressBufferOps` `processModule` (slang-ir-byte-address-legalize.cpp:51) rewrites a BAB param
to SB<T> only when it reaches a load or store. -preserve-params keeps every global_param through DCE (slang-emit.cpp:1491), so two cases reach
slang-emit-spirv.cpp:3070: an unused BAB, and the stale param of a used `BAB arr[2]`.
The recommended fix (A) is to convert every leftover BAB or array-of-BAB param to SB<uint> via `getEquivalentStructuredBufferParam`
and then extend tests/spirv/byte-address-buffer-preserve-params.slang. Rejected: B, native BAB emit (a consumer patch), and C, a keepAlive-only DCE.

**GitHub state (verified 10-29 17:5xZ).** Labels `reproduced` and `bot-ok`; Type=Bug; 1 comment,
nv-slang-bot 6504173313 at 17:48:12Z.

**Owners.** slang-triager `sess-1793295574869-3oc1k9`; slang-fixer `sess-1793296040973-892j2l`
(worktree wt-slang-14039). Both are on thread `gh-issue-shader-slang/slang-14039`.
Memo: `/workspace/inbox/a2a-1793296121016-hn4r1o/triage-14039.md`.

**PR #14045** (draft, `fix/issue-14039`, head 227cc7372, opened 19:09Z). It makes 3 changes:
- `translateUnusedByteAddressBufferParams`
- `removeDeadElementAccesses`
- the BAB pass gate in `slang-emit.cpp`, changed to the `IRByteAddressBufferTypeBase` base class

**Peer review (slang-reviewer `sess-1793301716763-g3ubdl`, 10-29 20:02Z). These are the reviewer's findings.** Verdict APPROVE_WITH_NITS with 0 bugs. The full suite on head is 11071/11074 (3 known fp8-cuda). The revert drill fails a test for each of the 3 changes.
- Top gap: the base-class gate also fixes an **undisclosed second ICE**. On master, SPIR-V hits E99997 for a ROV BAB used only through `GetDimensions`/`Interlocked*`, even without `-preserve-params`. This needs a test and a mention in the PR description.
- The `contains(param)` skip and the GLSL declaration change (block name only) have no tests.
- The reviewer sent the fixer a remedy patch: 4 tests, 8/8 on head, 3 of them Vulkan.
- The review was not posted to GitHub. I verified that the fixer received it (fixer rows 18/20/22).
- Side note: nested `[2][3]` BAB arrays already fail spirv-val on master, so they deserve their own issue.

**10-29 20:21Z: resolution (the triager's report, which I checked on GitHub).**
- #14045 is no longer a draft. Head is 0c1668d55: 10 files, +304/−2, label `pr: non-breaking`.
- Review is requested from pdeayton-nv and team `dev`. The triager says the reporter marked it ready at 20:15Z.
- All nits and the optional Vulkan test are applied. The optional post-condition assert was skipped.
- 13/13 PR test rows pass. CI was dispatched again at 0c1668d.
- The newest bot status on the issue is fixer comment 6506027206 (19:13Z).

**10-30 17:43Z: maintainer review round 1 (the triager's report, which I checked on GitHub).**
- tangent-vector left 3 COMMENTED reviews (17:30–17:32Z) with a question and a style nit.
- The question was why the pass does not translate every BAB up front. tangent-vector answered and resolved it themself.
- The nit is applied in comment-only commits 5b7db2519 and 35e787227. The bot replied at r4426670317.
- `reviewDecision` is empty, pdeayton-nv's review is still pending, and the subset passes 1133/1133.

**11-02 05:21Z: approved.** pdeayton-nv (MEMBER) APPROVED on 35e787227. mergeState is BLOCKED and reviewDecision is still "".
The triager reported that CI "never started" (queued since 10-30) and advised a cancel and re-run. ❌ **That diagnosis was wrong**, and I corrected it:
- pull_request run 41100753757 finished 44/45 jobs green on 10-30.
- The 45th job waited on purpose. `falcor-build-approval-gate` (ci.yml:452) uses `environment: falcor-ci`, which needs a deployment approval. That approval landed at 05:21:45Z.
- `build-windows-release-cl-x86_64-gpu-falcor` was then created at 05:21:47Z and queued for a `Windows,self-hosted,build` runner.
- A re-run would have thrown away the 44 green jobs.
- The dispatch run 41100768311 is a side run (`wait-for-human-priority` and `check-ci` failed). It does not matter here.
**Lesson:** a run with `status=queued` whose `updated_at` is fresh is usually a gated job just released. Check the jobs list before calling it stuck.

**Next.** The Falcor build runs on Windows, then a maintainer merges. If the job is still queued with no runner after several hours, that is a runner problem for the babysitter or the operator. The triager accepted the correction at 05:26Z. It had posted nothing on GitHub, it relayed the correction to the fixer and filed a shared learning, and it set one-shot re-check `t-676488` for 11-02 09:30Z. The chain rests until the PR is merged or closed, and the webhooks route to the fixer.
⚠️ Both pr-approvers are paused (re-checked 10-30). Do not forward a `pr_ready_for_review` webhook for #14045 to an approver.
**10-30:** first approver webhook (synchronize, head still 0c1668d5) reached Main; not forwarded, queued in `data/approver-pause-queue.md`, operator told. tangent-vector left a COMMENTED review 10-30 17:30Z (routes to the fixer via pr-mapping).
**11-02 09:31Z: CI all green (re-check t-676488; the triager's report, which I checked on GitHub at ~09:35Z).**
- Run 41100753757 completed/success. The Falcor build got a runner at 05:38Z and passed at 05:46Z; `test-falcor` passed 05:58→06:43Z.
- Rollup: 56 SUCCESS, 6 SKIPPED, 0 failed or pending. The 2 null-conclusion rows are status contexts (`SlangPy Tests`, `license/cla`) with state SUCCESS.
- Still OPEN at 35e787227. mergeState BLOCKED, mergeable MERGEABLE, reviewDecision "", no auto-merge, no requested reviewers left.
- The master rulesets (`rules/branches/master`) hold only deletion, non_fast_forward and copilot_code_review, so the block comes from classic branch protection (403 for our token). It is probably a second or code-owner approval. Unconfirmed.
- No dispatch and no GitHub post. A maintainer must merge it or add the missing approval. The merge or close webhook routes to the fixer. The triager then removes the `active-work/shader-slang-slang-14039` sentinel. The supervise-issues tick walks this PR, so no extra timer is set.

**11-02 19:50Z: TERMINAL (checked on GitHub).** pdeayton-nv merged #14045 at 19:50:24Z (head 35e787227, merge commit 2518a942d).
#14039 closed as COMPLETED at 19:50:26Z. The fixer removed its worktree, the triager removed its sentinel, and `t-676488` has already run. Nothing is open.
Follow-up candidate, not filed: nested `[2][3]` BAB arrays already fail spirv-val on master (from the reviewer's notes).
