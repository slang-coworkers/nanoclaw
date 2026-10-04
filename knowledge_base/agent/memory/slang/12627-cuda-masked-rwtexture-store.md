---
type: chain
title: slang#12627 — CUDA/PTX component-masked RWTexture2D store emits a subscript on CUsurfObject
description: Fix is in draft PR #13363 (surface read-modify-write + warning E56006), held on jkwak-work's answer to the CUDA coherency question. Follow-ups #13361/#13362/#13364/#13365.
tags: [slang, cuda, ptx, rwtexture, legalize-image-subscript, held, awaiting-maintainer]
---

# slang#12627 — CUDA masked RWTexture store (draft PR #13363, held on jkwak-work)

Assignee and PR shepherd: jkwak-work. Fixer session `sess-1787171888548-4gv6cq` (thread `gh-issue-shader-slang/slang-12627`).
Reviewer session `sess-1790828246458-ehy88h`. My origin session is `sess-1787170935547-1z63sa`.

## State (checked live 2026-10-04 02:15Z)

- **PR [#13363](https://github.com/shader-slang/slang/pull/13363):** draft, `fix/issue-12627`, head `899bbbe624`,
  5 ahead / 12 behind master, no human reviews. Gated CI hasn't run because it's a draft. `license/cla` is
  pending (the bot-identity problem, tracked in `rechase-cla-bot-identity-*`; not a required check).
- **Open with jkwak-work, unanswered since 10-01 03:10Z.** One reply settles both:
  [coherency Q](https://github.com/shader-slang/slang/issues/12627#issuecomment-5923952063): (a) keep the RMW with a warning,
  or (b) make it a compile-time error on CUDA. The warning-scope question
  ([5923147529](https://github.com/shader-slang/slang/issues/12627#issuecomment-5923147529)) asks CUDA-only or all
  RMW targets. Secondary: [5925676317](https://github.com/shader-slang/slang/issues/12627#issuecomment-5925676317) asks whether to fold #13364 into #13363.
- **Re-chase:** `rechase-12627-jkwak-8576` (2026-10-07 02:00Z).
- **Review:** round 1 was REQUEST_CHANGES with 0 bugs; fixed at `899bbbe624`. The round-2 run finished on 10-01, but the reviewer's
  session restarted before it merged the results, so the verdict was **never sent**. That went unseen for 3 days.
  The 10-04 re-chase nudged the fixer, which pinged the reviewer, which is now merging the results.

## Follow-ups (all bot-filed, not dispatched, `doNotNudge` in supervisor-state.json)

- #13361 WGSL, same root cause. Assigned to jkwak-work, handed off.
- #13362 `+=`/`++`/`inout` on a texel. Ready for slang-fixer; needs an operator go.
- #13364 unify the CUDA surface spellings. Waits for #13363 to merge (or for jkwak-work to ask that it be folded in).
- #13365 C++/CPU `*(tex[coord]).w` compile failure. Independent; ready for slang-fixer; needs an operator go.

## Lessons

- **"Round N started, ETA 30–40 min" followed by silence is a stall, not progress.** A reviewer session that restarts
  mid-run loses the merge step, and nothing re-fires it. A re-chase should check that the reviewer actually sent its
  verdict, not just that GitHub is unchanged.
- From a task session, `send_message` with `target_session_id` + canonical `thread_id` (with no `in_reply_to`, since the
  task session has no inbound) landed in the pinned fixer session on the first try (row 52, 2026-10-04 02:12Z).
