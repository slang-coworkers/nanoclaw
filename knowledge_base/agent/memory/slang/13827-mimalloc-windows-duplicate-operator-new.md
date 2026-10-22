---
type: chain
title: slang#13827 — duplicate operator new/delete with newer mimalloc on Windows
description: "Reporter/assignee pdeayton-nv. Fix: MI_OVERRIDE OFF once in the SLANG_BUILD_MIMALLOC block of external/CMakeLists.txt. DRAFT PR #13850 @aedafd686 (pr: non-breaking), R1 APPROVE_WITH_NITS applied. Triage resolved 10-22 01:26Z. PARKED on pdeayton-nv running the Windows MSVC /MT reproducer + maintainer ready. Covered by webhooks + /supervise-issues; no timer."
tags: [slang, cmake, mimalloc, windows, build]
---

# slang#13827 — duplicate allocation operators with newer mimalloc on Windows

**Fix (slang-fixer, thread `gh-issue-shader-slang/slang-13827`):** `external/CMakeLists.txt` (+15/−5) sets
`MI_OVERRIDE OFF` once inside `if(SLANG_BUILD_MIMALLOC)`, before `add_subdirectory(spirv-tools)`, and drops the
fallback copy. Linux model of the Windows branch with mimalloc v2.5.2: master gives 40 duplicate
`operator new`/`delete` definitions; with the fix `slang` + `slang-glslang` link. Pinned v2.1.7 flags are unchanged.

**Review:** slang-reviewer R1 (head 192631fc5f) APPROVE_WITH_NITS, 0 bugs; the 3 comment nits are applied in aedafd6.
Review memo `/workspace/inbox/a2a-1792631633086-svz1s2/pr13850-r1-combined-review.md`. Not posted to GitHub.

**10-22 01:26Z, triage resolved.** I checked it live at ~01:30Z: PR #13850 is OPEN, a draft, at head `aedafd686` with
`pr: non-breaking`. Checks: 5 pass, 53 skipping. CI runs 39705397304 and 39705399934 cover only v2.1.7. Bot issue
comment 6329929004 was edited at 01:25:56Z.

**Untested:** the Windows MSVC `/MT` link with v2.5.2, because no Windows host was available.

**Parked on:** pdeayton-nv running the issue's PowerShell reproducer on the PR head. A maintainer then decides on
ready-for-review. This is not an operator decision. Resumes on a human comment on #13827/#13850.

**10-22 ~01:35Z, CI queue starvation.** slang-discord-support flagged a CRITICAL queue. I checked it live: CMake Options
run 39705399934 was dispatched by nv-slang-bot on `fix/issue-13827` at 01:23:29Z with 478 jobs (440 queued, 24 in
progress, 14 done). It re-dispatches 00:40Z run 39701043294, which it cancelled. The merge-queue CI run for #13839
(39702920501) is queued behind it. The run covers only the pinned v2.1.7, so it does not test the v2.5.2 path the fix
targets. I told slang-fixer to cancel it and not to re-dispatch the full matrix on a draft.
Cancelled by slang-fixer at 01:36:10Z (I confirmed it live). Cancelled the fallback task cancel-check-13850-cmake-0239. #13839 merge-queue run 39702920501 was still queued at 01:37Z; slang-discord-support checks the drain on its next wake.
