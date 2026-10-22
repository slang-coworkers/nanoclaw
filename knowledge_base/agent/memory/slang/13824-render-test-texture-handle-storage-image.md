---
type: chain
title: slang#13824 — render-test binds a Texture2D.Handle input as a Vulkan storage image
description: "External (albertrodriguezclo) 10-21 18:31Z. render-test's assignTexture reads the handle access from the reflected type; on SPIR-V the handle reflects as uint2, so access is NONE → ReadWrite → VK_DESCRIPTOR_TYPE_STORAGE_IMAGE, and reads return 0. Test-harness bug, not a compiler emit bug. TRIAGED 18:51Z (cmt 6323929737, reproduced, Type=Bug, P2, regression since #8814 but not labelled). Fix A (assignTexture uses textureDesc.isRWTexture) handed to slang-fixer (sess pz3euq). FIX REPORTED 21:14Z: DRAFT PR #13829 @4e83699fd (+81/−6, 4 commits, pr: non-breaking, pr-mapping → pz3euq), R1 APPROVE_WITH_NITS applied. PARKED on maintainer (jkwak-work assigned + review-requested); CI run 39676660520 status=waiting (gate). Reviewer v2 correction (uint64/spvBindlessTextureNV comment) landed in fixer inbox after the report and may add a commit. Covered by webhooks + /supervise-issues; no timer. Operator filing question on the CUDA RWTexture2D side bug asked once 10-21 ~18:5xZ."
tags: [slang, render-test, vulkan, descriptor-handle, bindless, triage]
---

# slang#13824 — render-test binds a `Texture2D.Handle` input as a storage image on Vulkan

**10-21 18:31:41Z, `issue_opened`.** Live read: open, 0 comments, no labels, unassigned, empty
timeline, `created_at == updated_at`. Reporter albertrodriguezclo (CONTRIBUTOR, external; same
reporter as #13633 / #13753 / #13771 / #13805). No open PR by the reporter references this issue
(checked their open PR list; #13755 is the Metal AnyValue handle fix, a different bug).

**Claim (reporter's):** `tools/render-test/render-test-main.cpp` `assignTexture` takes
`getResourceAccess()` from the reflected handle type's element type. On SPIR-V the handle is
reflected as `uint2`, element `uint` → `SLANG_RESOURCE_ACCESS_NONE` → `getDescriptorHandleAccess`
`default:` → `DescriptorHandleAccess::ReadWrite` → slang-rhi `BindlessDescriptorSet::allocTextureHandle`
writes a storage image (VUID-VkWriteDescriptorSet-descriptorType-00339). vk lane reads `1, 0, 0`,
cuda `1, 1, 1`. Forcing `Read` makes all vk variants pass. The reporter has not found how to get
the resource type from reflection.

**Routing:** to `slang-triager` on `gh-issue-shader-slang/slang-13824`. This container has an L40S,
so the vk lane can be reproduced here.

**10-21 18:51Z, triaged** (slang-triager sess `kxywo3`; memo `/workspace/inbox/a2a-1792608707783-sx5btf/triage-13824.md`).
Verified: bot comment 6323929737 exists (18:51:16Z), labels `reproduced`, Type Bug. Reproduced at HEAD `23f8fbe9b`
on the L40S: vk `1,0,0`, cuda `1,1,1`, VUID-00339 x4. Root cause confirmed: `slang-type-layout.cpp:5756-5780` reflects
the handle as a plain `uint2`. Introduced by #8814 (2025-10). Options: **A** (recommended) choose the access from
`textureDesc.isRWTexture` in `assignTexture` (the prototype passed 133/134; the one failure was a pre-existing failure
in a CUDA control); B is a new reflection API (public-API decision); C is a slang-rhi guard (other repo). B and C are
maintainer follow-ups and are only mentioned on the issue.
Fixer `slang-fixer` sess `pz3euq` on the canonical thread, building `fix/issue-13824` at 18:51Z.

**Unfiled side bug:** on cuda, a `TEST_INPUT: RWTexture2D` read through a plain `RWTexture2D` returns 0 (NaN with
RGBA8). Separate from #13824. I asked the operator once on the dashboard whether to file it; do not ask again.

**10-21 ~20:03Z, draft PR #13829** (`fix/issue-13824` @`a53f53938`, author nv-slang-bot, `pr: non-breaking`).
I checked it: the files changed are `tools/render-test/render-test-main.cpp` and the new test
`tests/language-feature/descriptor-handle/desc-handle-texture-test-input-gh-13824.slang`
(vk/dx12/cuda), and the pr-mapping points to fixer `pz3euq`. At 20:07Z CI had 4 checks passing and 52 skipped.
The triager updated cmt 6323929737 in place. I am holding the dashboard update until the Fix Report /
Triage Resolution comes in, so I send one consolidated report instead of several small ones.
**10-21 20:11Z, fixer status** (slang-fixer reports this; I have not checked the receipts): CI run `39667037595` dispatched. On the L40S,
vk fails on master with VUID-00339 and passes with the fix with 0 VUIDs; the related suites go from 917/918 to 918/918.
slang-reviewer started R1 at about 20:11Z, with a verdict expected about 21:10–21:40Z. The Fix Report follows the verdict.

**10-21 21:14Z, [Fix Report]** (fixer `pz3euq`). I checked it: head `4e83699fd`, +81/−6, commits `2f624f9` (repro) → `a53f539`
(fix) → `f0716d8` (comment contract) → `4e83699` (AnyValue placement test). Still draft, `pr: non-breaking`; jkwak-work
assigned and review-requested. Explanation cmt 6325403019 updated 21:11:23Z. CI run `39676660520` (CI, head 4e83699) is
`waiting`, and the PR checks show 4 passing and 52 skipped. dx12 is unverified (ignored on Linux). The fixer reports, but I
did not check, that the master repro fails with 3× VUID-00339, the fix passes with 0 VUIDs, the always-Read drill fails
with VUID-00337, and the related suites pass 918/918.
**After the report:** the reviewer sent the fixer (seq 24, 21:14:40Z) "v2 files", which replace the earlier remedy:
the comment also names `uint64` under `spvBindlessTextureNV`, and it says run 39667037595 was *cancelled*, not
waiting. So one more commit may land on top of 4e83699. The fixer owns this, and I don't need to nudge it.
Nothing human on the PR yet (only coderabbit and github-actions bots). Parked on maintainer review; webhooks and
/supervise-issues cover it.
**10-21 21:16Z, [Triage Resolution]** (triager `kxywo3`): triage chain closed. Final status is in bot cmt 6325492220 on the issue.
The `active-work` sentinel stays until #13829 is merged or closed. The dashboard got the parked status at 21:1xZ, so the Resolution
needs no second dashboard row. Resume on: a maintainer review or comment, a CI webhook, or the reviewer's v2 commit from the fixer.
**10-21 21:58:51Z, reporter verified #13829** (cmt 6327469908, `pr_mention` webhook, no @-mention so not a summons; held: no
dispatch, no bot post). The live body matches the payload. They applied head `4e83699` on master `a801f2685`, on Windows with an RTX 4060 Ti.
The repro gives vk `1,1,1`; the AnyValue+100 variant gives `101` on both vk lanes and on cuda; there is no VUID-00339; related suites
pass 148/148. dx12 is not checked on their machine either, so CI is still the only dx12 check. PR still draft @4e83699fd,
checks 5 pass / 52 skipped. I sent one FYI to the dashboard.
