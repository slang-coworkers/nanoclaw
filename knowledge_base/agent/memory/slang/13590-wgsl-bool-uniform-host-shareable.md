---
type: chain
title: slang#13590 — WGSL emits `bool` members in `var<uniform>` structs
description: "j8asic, human-filed WGSL bug: bool uniforms/cbuffer members stay `bool`, which isn't host-shareable, so Chrome rejects the module. SPIR-V already lowers bool to int. slangpy#787 (same author, Emscripten) works around it with `uniform uint`. Dispatched to slang-triager 2026-10-13."
---

# slang#13590

**2026-10-13 10:5xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by j8asic, `updated_at` = `created_at`, live body = payload. The
only session on `gh-issue-shader-slang/slang-13590` was this Main webhook session. `gh search`
found no duplicates ("wgsl bool uniform", "host-shareable bool"). No task names it.

Context: the reporter also authored slangpy#787 (Emscripten/browser support, OPEN), which works
around this with `uniform uint is_srgb_format` in `src/sgl/ui/imgui.slang`. #787's
ready_for_review webhook is parked in `approver-pause-followup-b5f2` (approver paused).

Orchestrator pointer (unverified, master 07cfeed8a3): in `slang-ir-lower-buffer-element-type.cpp`,
`needsElementLowering` (:363) already includes `IRBoolType`, but the bool → int leaf lowering in
`lowerLeafLogicalType` (:2895) runs only for `case SPIRV/SPIRVAssembly` (:2905); every other
target falls to `default: break` (:2947), so WGSL keeps `bool`.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13590`.

**2026-10-13 11:17Z, triaged** (slang-triager `sess-1791888815449-o29yxq`,
[cmt 6144341398](https://github.com/shader-slang/slang/issues/13590#issuecomment-6144341398);
memo `/workspace/inbox/a2a-1791890276919-kktc35/triage-13590.md`): bug / medium / P2, labels
`reproduced` + `WebGPU`, Type=Bug. This is long-standing, not a regression (v2025.1 → v2026.19). 16 shapes fail
naga; `SB<bool2>` also fails spirv-val on SPIR-V. My pointer was only part of it: there are three gaps in
`slang-ir-lower-buffer-element-type.cpp`. (1) bool→int is only in the Khronos leaf (:2895). WGSL picks its
own policy (:3267), so a shared `case` would be dead code. (2) The WGSL std140 array widening (:660-706)
overwrites the leaf conversion with `VectorReshape`, so it needs a combined reshape+cast. (3)
`needsElementLowering` (:363) skips top-level bool vectors. The reverted prototype (+88/−1) passes all shapes
except bab (#10207, separate path) and push-constant, and subsets pass 4305/4305. Fixer released on the
canonical thread (`sess-1791890267824-pmxbv5`, handoff row seq 2 at 11:17:47Z) for a draft PR `Fixes #13590`.
The fixer decides u32 vs i32 and whether to share the Khronos helper.
Operator question, unfiled: on WGSL, `[vk::push_constant]` → `var<uniform>` has no `@binding` (v2025.1+,
fails with `uint` too).

**2026-10-13 12:56Z, fixer build** (`slang-fixer`, `fix/issue-13590`, worktree `wt-slang-13590`, Release incremental).
Codex approved the plan, a refined Approach A. It also fixes a `bool4[N]` reshape-fold that the triager's prototype missed.
No PR yet; the triager reports the PR number up when it opens.

**2026-10-13 14:05Z, after the fleet restart (14:03Z).** No PR on `fix/issue-13590`. The fixer's last outbound
row is the 12:56Z build-start; the restart's resume notice landed as its seq 8. Re-chase one-shot
`rechase-13590-wgsl-bool-8a3a` is armed for 16:30Z. It checks the PR and fixer rows, nudges once (pinned) if
the fixer went silent, and re-asks the push-constant sibling question if the operator hasn't answered.

**2026-10-13 16:31Z, re-chase (case c).** Still no PR on `fix/issue-13590`, and no human comment since the triage.
The fixer's newest row is still the 12:56Z build-start (seq 9). It wrote nothing after the 14:03Z restart (seq 8).
The session shows active, last_active 14:04, and there is no phantom fixer session on the thread. I sent ONE nudge
to slang-fixer, pinned to `sess-1791890267824-pmxbv5` on the canonical thread. I re-asked the operator once about
the push-constant sibling (no answer since ~11:20Z). Next one-shot: `rechase-13590-wgsl-bool-87c3` at 18:31Z. If
still silent, it escalates as stuck instead of nudging again. It does not re-ask the sibling question.

**2026-10-13 16:31Z, re-chase `-8a3a` fired**, case (c): no PR and no fixer row after the restart. It sent one
pinned nudge and armed `rechase-13590-wgsl-bool-87c3` for 18:31Z (if the fixer is silent again, escalate as stuck; no second nudge).
**16:56Z, the fixer replied** (msg 42): the build survived the restart. The fix is refined Approach A in 5
commits, and the full suite passes 7790/7791; the one failure is the pre-existing gfx-smoke. Its `/code-review` found a new WGSL ICE: a whole
bool-array copy from a cbuffer into an SB leaves a `CopyLogical`. It also found a wrong expected value in the GPU test.
The fixer is fixing both, then re-verifying and running CODE_REVIEW before opening the PR. At 18:31Z `-87c3` should take case (b) or (a).

**2026-10-13 17:48Z, DRAFT PR [#13607](https://github.com/shader-slang/slang/pull/13607)** ("WGSL: store bool in
uniform and storage buffers as u32"), opened by the fixer. Verified live at 17:56Z: OPEN draft, head 9b07cdba16, 6 commits,
+366/−54, 4 files (`slang-ir-lower-buffer-element-type.cpp`, `tests/wgsl/bool-host-shareable{,-compute}.slang`,
`tests/spirv/structured-buffer-bool-vector.slang`). Label `pr: non-breaking`, `Fixes #13590`, assignee and review request
kaizhangNV, no human reviews. CI jobs are all SKIPPED (draft). The pr-mapping points to the fixer session `sess-1791890267824-pmxbv5`.
Explain-diff comment posted at 17:52Z (msg 50 HTML). Fixer's claims (unverified): full suite 7822/7823 (only
gfx-smoke cpu fails, same as master); 26/28 bool-bearing shaders pass naga; reflection and HLSL/GLSL/Metal output byte-identical
to master across 31 shaders. The issue side has only the timeline cross-ref, no PR-pointer comment.
Re-chase `rechase-13590-wgsl-bool-87c3` re-pointed to 10-14 16:00Z to watch the PR.
**18:01Z (fixer msg 62):** CI was dispatched. Run 38441659432 (`workflow_dispatch`) has been `waiting` on the approval gate since
17:48Z, the same gate as #13572. `report_pr_created` is done, and the review request to slang-reviewer has gone out. After the reviewer's verdict the fixer
sends its [Fix Report] to the triager, and the triager reports up.
**20:01Z (fixer msg 68):** the internal slang-reviewer verdict is APPROVE_WITH_NITS, with 0 bugs. The fixer is applying the nits: a one-line
VectorReshape peephole fix plus a non-bool WGSL copy test (L1), a runtime store test that can actually fail (A-G1), and
comment clarifications. After re-verify it pushes, then sends its [Fix Report] to the triager, who reports up. The head will move off 9b07cdba16.
**20:44Z (fixer msgs 70/72), verified live:** head **7851898586**, 9 commits, +424/−57, still a draft, 0 human reviews or comments.
The R1 nits are applied (peephole L1 fix and a store check that can actually fail), and the explanation HTML has been refreshed for that head. The [Fix Report] went to slang-triager.
CI run 38462553148 is waiting on the human-priority gate, and the fixer says auto-retry handles it. Next: kaizhangNV's review. The triager's roll-up is expected next.

**2026-10-13 20:49Z, [Triage Resolution]** (slang-triager msg 78). Verified live: the triage comment 6144341398 was edited in
place at 20:48:52Z (2547 chars) and its Next-action now says "draft PR #13607, held pending review". The issue is OPEN with 1 comment. The PR is a
draft at 7851898586 with 6 files. The fix is a `lowerBoolToIntStorage` helper shared by the WGSL and Khronos policies, std140 widening
combined with the cast, discovery of top-level bool vectors, unpack/repack on copies between storage layouts (CopyLogical is
SPIR-V-only), and a fix to the peephole's scalar-swizzle result type. Fixer-reported: suite 7823/7824. **The chain is HELD on kaizhangNV's review and CI**
(dispatch 38462553148 yielded on priority, auto-retry). When it merges, `Fixes` auto-closes the issue and the triager sends a final note only.
Unfiled follow-ups (operator call): (1) WGSL `[vk::push_constant]` emits no `@binding`; (2) `bool2` user varyings stay
`vec2<bool>` at `@location`. #10207 already tracks the ByteAddressBuffer path.
