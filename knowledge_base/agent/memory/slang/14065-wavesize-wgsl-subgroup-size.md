---
type: chain
description: "jkwak-work's same-repo PR (branch wavesize-wgsl-subgroup-size-checks): WGSL @subgroup_size + Metal/CUDA WaveSize warnings. Approver queued while paused; 10-30 maintainer asked the bot to file an issue (checks before simplifyIR) and assign it to him; slang-triager filed #14095 (assigned jkwak-work, verified live)."
---

# slang#14065: WGSL `[WaveSize(N)]` → `@subgroup_size(N)`

**PR:** https://github.com/shader-slang/slang/pull/14065. The author is jkwak-work, on same-repo branch `wavesize-wgsl-subgroup-size-checks`. It changes 7 files (+205/-3), including a new `tests/cross-compile/wave-size-targets.slang`.

**Approver:** `slang-pr-approver` is paused, so I didn't forward the PR. It is queued in `data/approver-pause-queue.md` at head 9cebf74c01 (first event 10-30, opened). A synchronize followed later that day; per the pause rule it got only the paused check.

**2026-10-30 15:20Z: the maintainer's filing ask.** It is r4425250691 (jkwak-work, inline reply at slang-ir-entry-point-decorations.cpp:99, on coderabbitai's r4424619277 "Validate folded values before CUDA and WGSL emission"): "can you file a new issue about this and assign it to me. ... we could make this more robust by moving the checking after the call to `simplifyIR()`."
- I acked it with 👀 on r4425250691.
- I dispatched it to `slang-triager` (msg 25, `<github-post-authorized />`, thread `gh-pr-shader-slang/slang-14065`, in_reply_to the webhook seq 14). The triage session is `sess-1793373783738-dt7hj0`. The steps: dedup, file the issue, assign jkwak-work, verify the assignee live, reply on the thread. No push, no review, no fix.
- I sent it to the triager, not the fixer, because of the #13647 → #13807 precedent, where the assignment stuck. On #13894 the fixer filed the issue but no assignee stuck.
- **Resumes on:** the triager's report (issue number, live assignee, URLs). Verify it live before relaying.

**2026-10-30 15:49:55Z: the triager filed slang#14095** ("[WaveSize] CUDA and WGSL checks miss link-time constant operands because they run before simplifyIR"). Verified live at 15:50Z: assignee `jkwak-work`, no labels, 0 comments. The `issue_opened` webhook reached me; I did **not** dispatch it, because this chain owns it. The triager session was still `running` at 15:50Z and had not yet replied on r4425250691.
- **Resumes on:** the triager's report and its reply on the r4424619277 thread. If there is no reply by the next tick, nudge `sess-1793373783738-dt7hj0` on thread `gh-pr-shader-slang/slang-14065`. The fix belongs to jkwak-work (assigned), so no fixer dispatch.

**15:51Z: triager [Report] (msg 30), verified live by Main.** The bot filed **#14095**: "[WaveSize] CUDA and WGSL checks miss link-time constant operands because they run before simplifyIR". It is OPEN, author app/nv-slang-bot, assignee **jkwak-work** (the assignment stuck because the triager made a separate POST to `/assignees`), with no labels. The inline reply is r4425568810 (nv-slang-bot[bot]) in the r4424619277 thread. The triager reproduced three link-time cases on PR head e961f2162 that compile silently; the same cases with literal operands give E56115/E56114. It found no duplicate (related: #13767, #9891, #13534). No push or review on #14065. Repro: triager's `repro-14065/`; worktree `wt-14065` (about 5 GB Release build, prunable).

**Filing ask CLOSED.** #14095 is jkwak-work's. The PR's only open item is the paused approver queue entry (re-read the live head at dispatch).
