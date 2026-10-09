---
type: chain
title: slang#12627 — CUDA/PTX component-masked RWTexture2D store emits a subscript on CUsurfObject
description: Fix is in draft PR #13363 (surface read-modify-write + warning E56006), peer review complete at b79ae81e23, held on jkwak-work's answer to the CUDA coherency question. Follow-ups #13361/#13362/#13364/#13365.
tags: [slang, cuda, ptx, rwtexture, legalize-image-subscript, held, awaiting-maintainer]
---

# slang#12627 — CUDA masked RWTexture store (draft PR #13363, held on jkwak-work)

Assignee and PR shepherd: jkwak-work. Fixer session `sess-1787171888548-4gv6cq` (thread `gh-issue-shader-slang/slang-12627`).
Reviewer session `sess-1790828246458-ehy88h`. My origin session is `sess-1787170935547-1z63sa`.

## State (checked live 2026-10-04 03:25Z; re-checked 10-07 and 2026-10-09 02:00Z: unchanged, still no human reply)

- **PR [#13363](https://github.com/shader-slang/slang/pull/13363):** draft, `fix/issue-12627`, head `b79ae81e23`
  (merged master `6ba151dcfc`, no force-push), 22 files +913/−155, no human reviews. On 10-09 it showed `BEHIND` master, which is
  fine for a draft. The only event since 10-01 is jkwak-work removing the `Dev Opened` label on 10-08 01:17Z, part of a
  bulk label sweep (same minute as #13324). It isn't an answer. CI on the draft: 4 pass / 1 pending /
  56 skipping (gated CI doesn't run on drafts). `license/cla` is pending: bot-identity problem, not a required check.
- **Peer review is done: both rounds used.** R1 REQUEST_CHANGES with 0 bugs, fixed at `899bbbe624`. R2 REQUEST_CHANGES with
  0 bugs (2 gaps, 2 nits), fixed at `b79ae81e23`. The `[Fix Report]` arrived 10-04 03:22Z. Caveats: both Reviewer A runs were
  budget-capped and incomplete, and Devin timed out; the coordinator verified A's findings by hand. G4 (duplicate warning per
  specialization) was declined, with the reason in the PR. Clarity items C007 and FG001 are deferred.
- **New diagnostics:** E56006 warning (CUDA-only, provisional), E56007 (conversion unavailable) and E56008 (unspelled shape)
  errors. Both errors cover cases that already failed in nvrtc, so they don't break working code.
- **Open with jkwak-work, unanswered since 10-01 03:10Z.** One reply settles both:
  [coherency Q](https://github.com/shader-slang/slang/issues/12627#issuecomment-5923952063): (a) keep the RMW with a warning,
  or (b) make it a compile-time error on CUDA. The warning-scope question
  ([5923147529](https://github.com/shader-slang/slang/issues/12627#issuecomment-5923147529)) asks CUDA-only or all RMW targets.
  Secondary: [5925676317](https://github.com/shader-slang/slang/issues/12627#issuecomment-5925676317) asks whether to fold #13364 in.
- **Re-chase:** `rechase-12627-jkwak-39ce` (2026-10-12 02:00Z). On 10-07 02:16Z I asked the operator on the dashboard whether to
  post one short re-ping on #12627. They hadn't answered by 10-09 02:00Z, so I asked again then. I don't post it myself.

## Follow-ups (bot-filed, not dispatched, `doNotNudge` in supervisor-state.json)

On 2026-10-05, maintainers triaged all four (re-checked 10-09: no comments, unchanged): they assigned owners and set milestones. A follow-up that a human now owns is not
dispatched unless that assignee or the operator asks.

- #13361 WGSL, same root cause. Owned by jkwak-work, Q4 2026.
- #13362 `+=`/`++`/`inout` on a texel. jhelferty-nv assigned it to **jvepsalainen-nv** (no milestone).
- #13364 unify the CUDA surface spellings. jkwak-work self-assigned, Q1 2027. Waits for #13363 to merge.
- #13365 C++/CPU `*(tex[coord]).w` compile failure. jkwak-work self-assigned, Q4 2026.

## Lessons

- **"Round N started, ETA 30–40 min" followed by silence is a stall, not progress.** A reviewer session that restarts
  mid-run loses the merge step, and nothing re-fires it. A re-chase should check that the reviewer actually sent its
  verdict, not just that GitHub is unchanged.
- From a task session, `send_message` with `target_session_id` + canonical `thread_id` (with no `in_reply_to`, since the
  task session has no inbound) landed in the pinned fixer session on the first try (row 52, 2026-10-04 02:12Z).
