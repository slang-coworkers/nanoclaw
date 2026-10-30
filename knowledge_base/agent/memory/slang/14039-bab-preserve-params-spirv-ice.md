---
type: chain
title: slang#14039 — unused ByteAddressBuffer + -preserve-params ICEs in spirv-emit
description: Human bug (pdeayton-nv, `bot-ok`) 2026-10-29 17:34Z. Triaged and reproduced (not a regression; the remainder of #9262). Bot PR #14045 is ready for review (head 0c1668d) with the nits applied. Resting on maintainer review and merge.
tags: [spirv, byte-address-buffer, legalization, preserve-params, bug, awaiting-maintainer]
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

**Next.** A maintainer reviews and merges #14045. The chain rests until the PR is merged or closed, and the webhooks route to the fixer.
⚠️ Both pr-approvers are paused (checked 10-29). Do not forward a `pr_ready_for_review` webhook for #14045 to an approver.
