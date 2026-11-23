---
type: chain
title: "slang#14474 history 1/3 — filing, triage during the auth outage, fixer crash-storm (11-16)"
description: "11-16 06:42Z–12:46Z: filed with an explicit bot ask; P2 triage during the fleet GitHub-auth outage; fixer crash-storm; the 07:35 duplicate-session false positive; auth restore and the pinned resume nudge. Split out of [[14474-disable-exceptions-fatal-diagnostic-process-death_history.md]]; live state in [[14474-disable-exceptions-fatal-diagnostic-process-death.md]]."
tags: [slang, exceptions, no-throw-api, history]
---

# slang#14474 history 1/3: filing, triage, crash-storm (11-16 morning)

## Morning: filing, triage, auth outage (06:42Z–08:10Z)

- 2026-11-16 06:42Z filed by lujinwangnv (human); explicit bot ask verbatim:
  "@nv-slang-bot please triage and fix this." (issue comment 6864244931) → post-authorized,
  R6 no-wait. Dispatched slang-triager ~07:1xZ on `gh-issue-shader-slang/slang-14474`
  DURING the fleet GitHub-auth outage (operator alerted 04:41Z + 07:00Z addendum; my
  gh/curl = 401 Bad credentials) — triager told to park any 401 post and report.
- First turn attempts (mine 06:51Z, triager 07:17Z) died with the transient host error
  ("Sorry, something went wrong"); webhooks redelivered ~07:07Z; triager re-driven with a
  pinned nudge (in_reply_to 28, target_session_id sess-1794812975323-ebb6jo, verified
  landed as triager seq 4).
- 07:25Z: **TRIAGED** — bug/high/P2, frontend (module-load diagnostics-exception plumbing),
  NOT a regression (TODO-acknowledged design gap), not a dup of #14448; #12779 out of
  scope per author. REPRODUCED on ToT cdca151fb (build-noexc: SIGILL exit 132 on the fatal
  E40003 path; control build clean 255; plain non-fatal error in no-exc build also clean
  255 — only Fatal severity kills). Full memo:
  /workspace/inbox/a2a-1794813940786-00h2qk/triage-14474.md — key pointers:
  slang-signal.cpp:154-184 (#else branch trap/exit), slang-exception.h:14-18
  (SLANG_EXCEPTION_TRY compiled out), slang-session.cpp:313-354 (recovery catch
  #if-gated) + 1558-1570 (fatal CompilationCeased emit), in-tree setjmp TODO
  slang-end-to-end-request.cpp:1951. **Approach A recommended** (setjmp/longjmp escape
  for AbortCompilation at existing SLANG_EXCEPTION_TRY boundaries, no-exc builds only;
  install loadModule/compile/link first; destructor-skip caveat in PR description;
  Approach B = follow-up, don't bundle).
- 07:26Z: triager's GitHub post attempt 401'd as predicted — 5-bullet parked verbatim at
  the triager's memory/issues/comment-14474.md; its own one-shot retry task t-bd0bcb.
  Triager saved a learning (FetchContent overrides for builds during the outage).
- 07:28Z: fixer's first turn died with the same host-error class; 07:30Z triager re-drove
  it on its edge; fixer recovered mid-work. Fixer correction: the triager's prebuilt
  no-exceptions tree (slang/build-noexc, .tmp-build/repro14474/) is NOT visible to the
  fixer (per-group workspaces) — it builds its own from the memo's recipe.
- 07:32Z triager [Report]: chain alive; safety-net probe t-36082c armed (no-op if fixer
  active). 07:35Z: fixer mid-work — building ToT no-exc slangc (repro) + default debug,
  base clone cdca151fb; GitHub ops deferred while the 401 persisted. 07:52Z: fixer
  IMPLEMENTING — debug + no-exc builds green, repro re-confirmed (no-exc SIGILL 132 /
  control 255 / solo.slang clean); plan at fixer's reports/slang-14474.md, PLAN_REVIEW
  round-1 amendments applied.
- 08:07Z: fixer bounced again ×2 (4th/5th crash). **08:10Z: Main alerted the operator
  dashboard** (fixer-runtime instability — 5 bounces, live #14474 + #13939 sessions
  affected, distinct from the approver redrive noise). t-36082c arbiter stood (10:30Z).

## The 07:35 false-positive collision (corrected 12:46Z)

- 07:35Z I recorded a "duplicate slang-fixer mint". **FALSE POSITIVE — there was never a
  second session** (corrected by the fixer 12:46Z): the fixer misread host-error replays
  of its own earlier turns as a peer owner, sent a "standing down" report naming its own
  session id, and went passive — stalling the chain ~5 h (partly masked by the auth
  outage). My 07:35 sessions-list check had shown only ONE fixer session — the
  disconfirming tell I rationalized away. Shared learning corrected in place: verify
  claimed peers in `ncl sessions list` before reporting/recording a collision; a
  stand-down from the sole owner = chain stalled.

## Auth restored, fixer stall, nudge (09:09Z–12:46Z)

- 09:09Z: gateway auth restored. 09:27Z: triager's parked GitHub actions COMPLETED and
  verified live (comment 6912544885 by nv-slang-bot[bot], `reproduced` label + Issue
  Type=Bug; fresh POST since no human triage existed). Retry t-bd0bcb cancelled; no
  parked artifacts remain — chain fully visible on GitHub. Auth-restore itself already
  reported to the dashboard by siblings; not re-alerted.
- 12:43Z: supervisor tick 342 — fixer never resumed after the auth restore (last_active
  08:15Z, container stopped, did not answer the 12:05Z fleet restart). Pinned resume nudge
  sent to jk0msz (delivered 12:42:59Z): resume from the intact worktree, push the draft
  PR, report. 12:46Z: fixer resumed — chain state re-verified on disk (worktree
  wt-slang-14474 @ cdca151fb, green debug + no-exc builds, repro re-confirmed, triage
  comment + `reproduced` live on GitHub; NO source edits yet), then maintainer-direction
  re-check, PLAN_REVIEW, implement, verify both configs, draft PR + [Fix Report].
