---
type: chain
title: slang PR #13473 — [Metal] avoid copying resource arrays into kernel contexts
description: "Fork PR by tomaszbk (head codex/metal-resource-array-context). 2026-10-23 jkwak-work asked the bot to start over: file an issue from the PR description; their impression is the problem is more generic than Metal. Dispatched to slang-fixer (pr-review-fix) to dedup-check and file it."
---

# slang PR #13473

**2026-10-23 17:45Z, webhook `pr_mention`** (comment 6371117750, jkwak-work). Live read: OPEN, not a draft,
fork head `tomaszbk:codex/metal-resource-array-context`, no linked issue, no labels. The only review is from
copilot. Shepherd: jvepsalainen-nv. No pr-mapping. Before the dispatch, the only session on the PR was this Main session.

The maintainer said: *"we need to start over from a proper analysis of the problem. I will ask @nv-slang-bot to file
an issue based on the PR description first … the current PR is too specific to Metal only when the issue sounds
more generic."*

The dedup search (gh search + the search API) found no issue for this problem. These are related and were not checked:
#11774, #13107, #13108, #13709, #11085. The ray-flag omission is tracked separately in #13413.

**17:48Z:** dispatched to `slang-fixer` in MODE=pr-review-fix with `<github-post-authorized />`, in_reply_to the webhook
row 2. The owner session is `sess-1792777720128-uwee1o` on `gh-pr-shader-slang/slang-13473` (verified running).
The fixer must not push to the fork, close the PR or assert that other backends are affected without evidence.
I made a COMMENT_URL typo (missing `/slang`) and corrected it in a follow-up (msg 17).

**17:52Z, fixer progress (msg 18):** the fixer says the dedup check is done and none of the five related issues covers this; it will cite them. It is now compiling the repro on Metal, CUDA, CPU and SPIR-V to find which targets copy, with a master build in progress. This is not a completion report.

**18:00Z, fixer progress (msg 20):** the issue draft is written. Fixer's evidence on master d29325a (not verified by Main): Metal copies the array in 3 shapes. CUDA and CPU index global arrays in place, except one CUDA entry-point case that also copies (768-byte stack frame). The draft is in the critique gate; filing and the PR reply come next.

**18:07Z, [Report] (msg 22) — done, verified by Main.** The bot filed **#13894** at 18:06:05Z: "Bound resource arrays are copied
per invocation instead of referenced (seen on Metal)". It is OPEN, problem-only, with no labels or assignees. The PR reply is
issuecomment-6371517758 (nv-slang-bot[bot], 18:06:19Z, with the AI disclosure footer). The fixer's evidence is from master d29325a
and v2026.20. Metal copies in 3 shapes (context entry, a reload across a branch, a __constref call site). CUDA and CPU index in place,
except an entry-point `uniform` array passed to a [noinline] helper, which is copied (768-byte stack frame, near #11774, not the
KernelContext pass). HLSL, GLSL, WGSL and SPIR-V do not copy. The issue leaves "Metal-only or generic" open for the maintainer.
Nothing was pushed to the fork and no review was posted.

**Parked** on jkwak-work's discussion on #13894. The PR's fate is the maintainer's call. Re-check: one-shot task
`rechase-slang-13894-r1` at 2026-10-27 13:00Z.
