---
type: chain
title: "slang#13555: -ignore-capabilities + case-less __target_switch → silent UB"
description: "External bug (minco3), opened 2026-10-09. Triaged bug/high/P2, reproduced, long-standing. GO 2026-10-10 on Approach A (tag the missingReturn in specializeTargetSwitch, diagnose survivors after the final DCE) as a draft PR with Fixes #13555, routed through slang-triager."
---

# slang#13555: `-ignore-capabilities` + case-less `__target_switch` → silent UB

**Origin.** minco3 (external, same reporter as [#13556](13556-cuda-samplegrad.md)) opened it 2026-10-09 23:11Z.
Under `-ignore-capabilities`, `SampleLevel`+offset, `SampleGrad`, and a `Buffer<T>` load on cuda/ptx compile rc 0.
The output is an infinite loop, an empty kernel, or a helper with no return. Without the flag they hit E36107.

**Routing.** Main session `sess-1791587498057-zjwoa9` dispatched to slang-triager on
`gh-issue-shader-slang/slang-13555`.

**Triage (slang-triager, 2026-10-10 00:53Z).** Comment
[6091831285](https://github.com/shader-slang/slang/issues/13555#issuecomment-6091831285). Checked on GitHub myself:
the comment is from the bot, labels are cuda+reproduced. Root cause checked in source at 08d419cbf:
`slang-ir-specialize-target-switch.cpp:73-88` emits `missingReturn` with no diagnostic unless `failedImplies`.
The rest are the triager's receipts (memo `triage-13555.md`, prototype diff in its `scratch-13555/prototype-B.diff`):
- Not a regression (2025.1 → 2026.16 identical). It also hits user-code `__target_switch` on
  cuda/cpp/metal/hlsl. cpp `Buffer<T>.Load` is an empty helper even without the flag.
- Erroring at specialize time is wrong: `sincos` false positive (`__sincos_metal` is linked before DCE). Erroring right
  after link-DCE gives torch/MS-texture false positives. Erroring after the final DCE is clean: 7755/7756, the one
  failure being gfx-smoke, which needs a GPU.

**Disposition (orchestrator, 2026-10-10 ~01:1xZ).** GO on Approach A as a draft PR with `Fixes #13555`, using the
standing proactive authority (drafts only). The reporter is external, nobody is assigned, there's no PR in flight,
and open PR #11225 touches only `slang-check-shader.cpp`. Routed through the triager, which owns the fixer edge.
- In scope: tag at the producer and a new error after the final DCE, ungated.
- Out of scope: the trap approach, the prelude stubs (#12630/#13377), and adding `case cpp:` to `Buffer<T>.Load`.
- PR body asks maintainers (1) whether the ungated scope makes this `pr: breaking change`, and (2) whether cpp
  `Load` should get a case instead of the error.
- My test note: draft #13559 adds a cuda `SampleGrad` case, so don't rely on it as the case-less repro. Use a
  user-code `__target_switch` or `Buffer<T>`.

**PR (2026-10-10 ~07:54Z).** Draft [#13564](https://github.com/shader-slang/slang/pull/13564).

Checked live: draft, `fix/issue-13555` → master, head `19b0b2e3ac`, 3 commits all by the bot, `pr: non-breaking`, closes 13555, 12 files +348/−4. The PR mapping goes to slang-fixer `sess-1791593655069-w74ros`. The PR body and the explanation comment carry both maintainer questions.
- **Design change, which the triager accepted:** on SPIR-V/GLSL/WGSL, E41037 now replaces E41009 inside `checkForMissingReturns`; every other target reports after the final DCE. The triager's reason: with only the late check, a case-less function returning `Texture2D` segfaulted in `specializeResourceUsage`.
- **Two pre-existing crashes, out of scope and unfiled:** the triager reports both on master 08d419cbf. spirv with `-disable-non-essential-validations` gives rc 139, and hlsl with `-ignore-capabilities` gives rc 139. Both are only mentioned in the PR's explanation comment.
- **Fixer's numbers:** 30/30 new tests; 13 of the 18 positive cases are silent on master. Full suite 7785/7786, the one failure being gfx-smoke, which needs a GPU. CI has not run yet (draft-gated).
- **Breaking-change exposure, per the fixer:** cpp `Buffer<T>` loads; exported / `[DllExport]` functions on cpp; built-ins that were no-ops under the flag (`GroupMemoryBarrierWithGroupSync` on cpp, `debugBreak` on metal).
- **Next:** slang-reviewer is reviewing, then the fixer's [Fix Report], then the triager's [Triage Resolution]. Ready/merge is operator-gated, and the label decision belongs to the maintainers.

**10-13 08:14Z hazard (reported by the triager on the #13544 chain).** The triager's `wt-13555` worktree is at `08d419cbf`, but its `build/` holds
#13547 (`6c65eea6c4`) binaries. Before relaying any #13555/#13564 measurement the triager makes from that worktree, check that it was rebuilt at
the SHA being cited.

**10-15 fixer run failure (triager report 13:45Z, checked by me 13:5xZ).**
- Fixer session `w74ros` timeline:
  - seq 30: round-1 REQUEST_CHANGES at 10:42Z.
  - seq 35: the fixer requested round 2, marked "(last)", at 11:10Z.
  - seq 40: round-2 REQUEST_CHANGES @ `1a9f927e67` at 12:43Z (1 bug and 4 gaps from A, "three fixes are small").
  - 13:02–13:12Z: the fixer pushed the round-2 fixes, ending at head `eac83d94ed`.
  - seq 42: the container was restarted by an instructions update at 13:13Z.
  - seq 43: "The agent run failed" at 13:43Z.
  - So the failure came on the resume after the restart, after the push. No [Fix Report] was sent.
- Cost is not the cause. The fixer is `ok` at $72.62 of a $150 cap. The reviewer `oe47tu` is escalated, but its decision was `continue` at 09:27Z, and its container is stopped because it is idle, not blocked. That makes the triager's "reviewer paused at its ceiling" stale.
- PR checked live: still a draft, 0 GitHub reviews, CI not run.
- Action: told the triager to re-dispatch the fixer on its own edge and ask for the [Fix Report] at `eac83d94ed`. If a second run also fails, it goes to the operator.

**10-15 13:58Z [Triage Resolution]: held draft, parked.** The re-dispatch worked, and the fixer sent its [Fix Report] at 13:58Z. Checked live 14:00Z: draft, head `eac83d94ed`, MERGEABLE, `pr: non-breaking`, 15 files +517/−6, 0 human reviews. The issue's only comment is still 6091831285, which is accurate.
- Round-2 items are mapped to commits. The fixer reports 48/48 new tests and a full suite of 8059/8060 (the failure is gfx-smoke, which needs a GPU), Debug rebuilt at `eac83d94ed`. Those are its receipts; I didn't re-run them. I accepted no round 3.
- The 35→36 version bump is correct, and the 10-10 "no bump" call was wrong. I checked at the head that `emitHostVMCode` (slang-emit.cpp:3798-3800) serializes linked IR, and `slang-ir.h:2257` has max=36.
- ⚠ **Merge collision, found by me:** draft #13425 (13423-metal-cb-scalar-layout, head c994d094e1) also claims stable opcode **909** (`Type.MetalConstantBufferLayout`), and its `slang-ir.h` comment says max=**36**. Whichever lands second must move to 910/37. It's a textual conflict, so git reports it rather than letting it pass silently. Eight other open PRs touch stable-names.lua; I haven't checked them.
- Open: (Q1) breaking? (Q2) cpp `case cpp:`? (Q3) ready/merge (operator). There's also a duplicate E41037 per generic specialization. The follow-up specializeCallSite crash, which also happens on master, is unfiled.
- Re-chase: one-shot `rechase-13564-maintainer-b2f8` on 2026-10-22 09:00Z.
- 10-15 14:10Z: the triager found a second collision, non-draft **#13406** (jhelferty-nv, `pr: breaking change`, CHANGES_REQUESTED, head `671215f5de`), which sets min=max=36. I checked this live myself. It conflicts with #13564 in `slang-ir.h` only. The hazard bullet is in explanation cmt 6095450396 (verified: bot, mentions #13406 and #13425). Decision: post nothing on #13406 or #13425. The PR that merges second resolves the conflict, git flags it, and both of our PRs are held drafts. Both re-chase prompts (`-b2f8`, `rechase-13425-maintainer-9a08`) now carry the cross-reference.

**10-21 09:00Z, from the #13425 re-chase:** master `9e17a9e850` (#13078, merged 10-19) took stable id **909** (`Decoration.glslPatch`) and max version **36**. Draft #13564 (`eac83d94ed`) claims both and is now **CONFLICTING**. #13425 was asked to move to 910/37, and #13406 (`e5ac28a647`) is now min=max=37, so #13564's next free values depend on which of those lands first. Note that `slang-ir.h` can auto-merge to a version number master already uses, so check the number by hand.

**10-22 09:0xZ re-chase (`rechase-13564-maintainer-b2f8`).**
- **#13406 MERGED** at 08:47Z as master `0bd71cd709`. Master is now at min=max=**37**, and its stable ids end at `Decoration.glslPatch` = 909. I checked both live.
- #13564 @ `eac83d94ed`: still a draft, now **CONFLICTING/DIRTY**. It still adds `noTargetCase` = 909 and max=36, and master already uses both.
- No human comments or reviews on #13564/#13555 since 10-15. Q1–Q3 are still parked.
- Draft #13425 @ `3a41ab51a0` claims 910 with max=37. Whichever of #13425/#13564 merges second moves to 911/39.
- Action: sent slang-triager (`33kqnm`, thread `gh-issue-shader-slang/slang-13555`) a merge-origin/master ask for the fixer `w74ros`. It asks for 910 and max=38 (min 37), with no rebase and no force-push. After that: rebuild, PR tests plus full suite, push, edit cmt 6095450396 in place, keep the draft and the label.
  - The first send returned `database is locked`. The retry is msg id 7, and the triager inbox shows one inbound (seq 26, 09:02Z), so it was not duplicated.
- Next re-chase: one-shot `rechase-13564-merge-veri-837b` on 10-29 09:00Z. Before that, expect the triager's report on the thread.

**10-22 09:44Z: the merge landed (triager report). I checked it live at 09:5xZ.**
- Head `100e058605`, parents `eac83d94ed` + master `0bd71cd709`, author is the bot. Still a draft, MERGEABLE, BLOCKED, `pr: non-breaking`, 0 reviews.
- At the head, stable-names ends `glslPatch`=909 then `noTargetCase`=**910**, and `slang-ir.h:2257-2258` reads min **37** / max **38**. Master is at 909 and min=max=37.
- CI run 39756995357 at that head is `waiting` on its gate. saipraveenb25 is a requested reviewer (github-actions, 10-10).
- Fixer's numbers (Debug build at the head, L40S): 48/48 new tests. Full suite 11178/11181; the 3 failures are `cooperative-matrix/fp8-cuda*` CUDA_ERROR_INVALID_PTX, which the fixer reports also fail on a master build at 0bd71cd709. These are its receipts; I didn't re-run them.
- **Collision still open:** #13425 @ `3a41ab51a0` (CONFLICTING) also claims **910**, with max 37. Whichever merges second moves to 911/39. That note is on `rechase-13425-maintainer-e658`.
- I authorized a Tests-line-only refresh of the PR body, since it was stale at 8059/8060. Q1–Q3 are still parked. The next one-shot is `rechase-13564-merge-veri-837b` (10-29), and its prompt is updated.
- 10-22 09:46Z: the Tests line in the PR body was refreshed to the 100e058605 numbers. I checked live: still a draft, same head and label, and `Fixes #13555` is still present. Parked until `rechase-13564-merge-veri-837b` (10-29).
