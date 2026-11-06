---
type: project
name: project_13805_wgsl_byte_address_aligned_array_load_store
description: "TERMINAL 11-05 04:04Z. MERGED: #13815 merged by jkwak-work (b3d4e7ad41) without a fresh approval (the 00:05Z one was dismissed by the 00:52Z merge-master push); #13805 closed COMPLETED. Worktree + triage sentinel removed. Resume only on a human comment on the closed issue/PR. slang#13805 (albertrodriguezclo, external): WGSL (+ Metal) aligned ByteAddressBuffer Load/Store of T[N] emits one u32 / u64 access for the whole array. Triaged regression (partial) / medium / P1. Fix A = add scalarizeVectorLoadStore to the array conditions in emitLegalLoad/Store. Handed to slang-fixer on gh-issue-shader-slang/slang-13805."
---

# slang#13805: WGSL aligned ByteAddressBuffer array loads/stores

**10-21 07:47Z `issue_opened`.** Main webhook session `sess-1792568872916-yktyv5` sent it to slang-triager on
`gh-issue-shader-slang/slang-13805` (triager `sess-1792568911360-dcmrlg`).

**10-21 08:08Z [Triage] (triager msg 10; memo copy at /workspace/agent/reports/triage/triage-13805.md):**
regression (partial) / medium / P1, IR `slang-ir-byte-address-legalize` → WGSL + Metal.
- Cause confirmed. I spot-checked origin/master 62fb75f99: the array branches (`:512` load, `:1473` store) test only
  `isWideAccessAligned`. The vector branches (`:623`, `:1582`) also check `m_options.scalarizeVectorLoadStore`.
- Partial regression: top-level arrays never worked. An array field at a non-zero struct offset regressed in v2026.11,
  because #11430 started folding `base + fieldOffset`. That PR is correct; it exposed the gap.
- Correction to the reporter: their `half a[1]` E56103 is the separate WGSL 16-bit gap (#13647 open PR, #13661 open issue).
  So a `half[N]` regression test depends on that gap being fixed.
- Fix A (recommended): the reporter's 2-line condition. B (guard in emitSimpleLoad/Store) and C (emit-side) were rejected.
- Metal is affected too (`as_type<array<...>>(pool[i])`), checked from the output only.
- Adjacent, not acted on: FXC `sm_5_0` templated `Load<float4[2]>`, which can't be checked on Linux.

**Verified live 08:1xZ:** triage cmt 6311200063 (nv-slang-bot, 08:07:42Z); labels `regression` + `reproduced`.
Type=Bug was not checked (the hook blocked the `.type` read).
Fixer session `sess-1792570043087-1l9zgy` on the canonical thread.

**Open loops:**
- The fixer checks for a reporter PR first (#13755 precedent: this reporter opened their own fix on #13753).
- Bot draft #13205 (fix/issue-13199, vec3 scalarize on SPIR-V/GLSL) edits the same `if` lines, so the two will conflict textually.

**10-21 10:08Z [Report] (triager msg 18):** the fixer opened draft PR [#13815](https://github.com/shader-slang/slang/pull/13815),
`fix/issue-13805`@6bbe40a: Approach A on both the load and the store branch, the option documented in the `.h`, and a new
`tests/wgsl/byte-address-buffer-aligned-array.slang` (WGSL + Metal filecheck; compute runs on wgpu/metal/vk/cpu/llvm).
I checked live: draft, 3 files (+162/-6). The diff is exactly the two `m_options.scalarizeVectorLoadStore ||` conditions plus a comment rewrite.
Issue cmt 6311200063 was edited in place at 10:07:44Z to say "fix in draft PR #13815, held for review".
CI shows `skipping` while the PR is a draft.
Next: the triager is waiting for the fixer's `[Fix Report]`, then sends the `[Triage Resolution]`.

**10-21 12:27Z [Triage Resolution] (triager msg 20):** fixed via Approach A. Checked live: #13815 is OPEN and a draft, head 19498e2,
labelled `pr: non-breaking`, 4 files +182/-14. CI run 39598430018 is `waiting` (the draft gate). The explanation is cmt 6313365583 on the PR.
The newest issue comment is the fixer's cmt 6315851915 (12:25:51Z). `pr-mappings` maps #13815 to fixer `sess-1792570043087-1l9zgy` on the canonical thread.
- slang-reviewer R1 returned APPROVE_WITH_NITS with 0 bugs. Nits 1-4, 6 and 8 were applied. Nit 5 (`hlsl.meta.slang` public doc) and
  nit 7 (Metal 16/64-bit filecheck) were deferred. codex approved the R1 changes.
- Tests: the new test passes 9/9, and 5 of its rows fail on master. Tint: 21 of the 34 probes error on master; with the fix, 27/28 of the non-half
  probes pass. The one that still fails is scalar `Load<uint64_t>`, which is out of scope. The 6 half probes give E56103 (#13647).
  On the L40S, the vk/cuda A/B run showed no new failures. HLSL, GLSL, SPIR-V, CUDA and C++ output is byte-identical.
- **Parked on:** a maintainer reviewing #13815 and marking it ready. Expect a textual conflict with bot draft #13205.
- **Out of scope, possible follow-ups (unchanged from master):** an aligned `uint3[2]` under SPIR-V std430 reads the wrong words; FXC `sm_5_0`
  gets a templated `Load<T[N]>`; Metal emits `as_type<bool>(uint)`. None has been filed.

**11-05 00:30Z [Report] (triager msg 24):** a maintainer flipped #13815 out of draft. jkwak-work commented at 00:03:54Z,
"@nv-slang-bot resolve the merge conflict with the master branch", and then APPROVED at 00:05:56Z ("Looks good to me", noting
the old wide-load path assumed SPIR-V-style emulation). I checked live: OPEN, non-draft, `CONFLICTING`, head still 19498e2.
The fixer acked at 00:05:27Z with "merge commit, no force-push", which matches the maintainer preference (#12194).
Triager's account: the fixer merged master locally. The only conflict was a comment-only hunk, resolved to master's version. The test's CHECK
order was updated for #13764's load folding. 9/9 pass, both revert drills fail. Tint: 23 failures on master, 32/34 OK at the merge.
Next: the fixer finishes the GPU A/B run, pushes, updates the explanation and replies to jkwak-work, and then the PR can merge.
The triager posts nothing more on the issue because `Fixes #13805` is in the PR.

**11-05 00:54Z [Report] (triager msg 26):** I checked live: MERGEABLE at head 034cb79. Merge commit 28cec0a7e has parents 19498e273 and master 662e552ee.
034cb79 is a test-only follow-up ("check per-element stores, not load order"). 19498e2 is an ancestor of 034cb79 (ahead 100, behind 0), so there was no force-push.
The reply to jkwak-work is cmt 6646525348. CI run 41944482409 is `waiting` on 034cb79.
Triager: the test passes 9/9 and the revert drill still fails it. The L40S A/B passed 181 vk and 124 cuda tests with no new failures; the 4 that fail do so with and without the fix
(3 fp8 CUDA PTX tests, llvm float-not-equal-nan). Tint: 32/34 OK. The 2 remaining are out of scope: scalar u64, and `Store<half[2]>` E56112, which matches the scalar half store gap (#13661).
#13647 has landed, so aligned `half[N]` loads now work.
Next: a maintainer merges once CI is green. The triager removes its sentinel after the merge. Resume only on a merge/close event, a CI failure, or a human comment.

**11-05 ~02:4xZ (Main, `pr_ready_for_review` synchronize webhook):** not forwarded, because slang-pr-approver is `paused=1`; queued in
`/workspace/agent/data/approver-pause-queue.md`. Checked live: the 00:54Z report's "APPROVED" is stale. jkwak-work's review (commit 19498e27) shows
`DISMISSED`; the timeline has `review_dismissed` at 00:52:00Z, actor nv-slang-bot[bot], empty message. That is the stale-review dismissal from the
merge-master push, not a maintainer action. reviewDecision empty, mergeState BLOCKED, MERGEABLE; CI 54 pass, 1 pending, 3 skipping, 0 fail.
Next: jkwak-work re-approves at 034cb79, then merges. Bot fixers cannot request review, so nothing was dispatched; the operator was told.


**11-05 04:04Z MERGED (triager msg 28).** I checked live: #13815 was MERGED at 04:04:27Z by jkwak-work, merge commit b3d4e7ad41. #13805 was CLOSED as COMPLETED at 04:04:29Z.
The fixer removed worktree `wt-slang-13805`, and the triager removed its sentinel. The chain is closed. The 3 out-of-scope follow-ups from 10-21
(SPIR-V std430 `uint3[2]`, FXC templated `Load<T[N]>`, Metal `as_type<bool>(uint)`) and the scalar u64 load gap were never filed. They are the operator's call.
Note: jkwak-work merged without re-approving. The only jkwak-work review is still the DISMISSED one at 19498e2, so they used a maintainer override.
My 00:54Z dashboard post said "approved, MERGEABLE". That was stale: my own check that turn showed `reviewDecision` empty, and I did not act on it.
The sibling Main's ~02:4xZ entry corrected it. Lesson: [feedback_merge_push_dismisses_approval_check_review_decision](feedback_merge_push_dismisses_approval_check_review_decision.md).
