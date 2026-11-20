---
type: chain
title: "slang#14474 SLANG_DISABLE_EXCEPTIONS fatal diagnostic — history, triage → PR #14501 resting (11-16)"
description: "Settled history of #14474 (11-16): triage during the fleet GitHub-auth outage, fixer crash-storm and the 07:35 false-positive collision, draft PR #14501, two review rounds, maintainer P1 concerns and jkwak-work's SLANG_BREAKPOINT direction applied at head 55ef7859e. Live state is in [[slang/14474-disable-exceptions-fatal-diagnostic-process-death.md]]."
tags: [slang, exceptions, no-throw-api, history]
---

# slang#14474: history, triage → PR #14501 resting on maintainer

Split out of [[slang/14474-disable-exceptions-fatal-diagnostic-process-death.md]] on
2026-11-17 to keep it under the 16k cap. **New dated entries go here, not into the live
record** — the live record holds current state only.

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

## Draft PR #14501 and review rounds (13:46Z–16:04Z)

- 13:46Z: **draft PR #14501 open** (head ce75e81e3, 4 commits, 11 files +272/−9:
  AbortCompilationEscape setjmp/longjmp mechanism in core, SLANG_EXCEPTION_TRY_RECOVERY
  macro layer, recovery installed at loadModule/loadModuleFromBlob/link/getTargetArtifact/
  compile, both-config tests; label `pr: non-breaking`, CI triggered, explanation comment
  posted, issue updated with the PR link). Pr-mapping row exists (slang-fixer
  sess-1794813961882-jk0msz → this thread). All 6 acceptance criteria met per fixer
  (no-exc repro: 255 via diagnostics, output identical to exceptions build, was SIGILL
  132; only AbortCompilation escapes; default build byte-unchanged — tests/diagnostics
  1083/1083, unit 688/688). Critique stages all approved (PLAN_REVIEW, CODE_REVIEW ×2,
  OUTPUT_REVIEW ×4). No CI lane builds SLANG_DISABLE_EXCEPTIONS (new tests cover it only
  locally) — flagged on the issue.
- 14:18Z: **reviewer verdict REQUEST_CHANGES** (combined A/B/C; full verdict sent to the
  fixer on its edge, file in my inbox
  /workspace/inbox/a2a-1794838701894-on2y80/combined-review.md). Bugs: dangling import
  stack after abort recovery (slang-session.cpp:328), locked session after fatal layout
  recovery (slang-linkable.cpp:788), failed modules remain in loaded caches
  (slang-session.cpp:479) — the longjmp destructor-skip risk family the triage flagged.
- 15:26Z: **round 1 answered at new head 9f8148f2d** (4 forward commits, no force-push):
  import-list reset in all five recovery arms; AbortRecoveryLock for the layout mutex
  (deliberate deviation from suggested double-checked locking, documented); third
  same-class bug (zombie half-compiled module in loaded-module caches) fixed via new
  reraiseAbortCompilation(); clarity comment batch + 2 suggested unit-test cases applied.
  Both-config verification green (repro 255 via diagnostics; 1083/1083 + 688/688; new
  repeat-failing-load check passes). **Round 2 dispatched (last round per policy).**
  Infra constraint (known pattern, same as #14037): bot token cannot push
  `.github/workflows/` — the requested no-exceptions CI lane is a ready-to-apply PR
  comment (cmt 6920727925) for a maintainer/workflow-capable token to apply.
- 15:43Z: **round-2 verdict REQUEST_CHANGES** (1 bug, 5 gaps; head 9f8148f2d). The 1 bug:
  a genuine stranded-lock regression inside the new recovery coverage; gaps = 2
  contract/documentation inconsistencies in the new protocol, unquantified per-abort
  leak, CI-coverage gap for the new path, 1 sizing-comment inaccuracy (core mechanism/
  macro pairing/lock-stack protocol/volatile handling all verified correct). Last
  reviewer round per policy — then the PR rests on maintainer review.
- 16:03Z: **[Fix Report] — chain RESTING on human review.** Final head cacce89e5 (10
  commits, 14 files +597/−26, master..cacce89e5): recovery at 7 boundaries (loadModule,
  loadModuleFromBlob, loadParsedModule, loadSerializedModule, link, getTargetArtifact,
  compile) + state restoration (import list, loaded-module caches, operation-mutex
  locks). Round-2 bug fixed; 4 items shipped-unresolved with documented causes:
  (1) no-exc CI lane — bot can't push `.github/workflows/` (#14037 pattern), ready-to-apply
  YAML in PR cmt 6920727925; #12782 (exceptions-disabled core, merged 09-29 by
  pdeayton-nv) is the related unblock path; (2) per-abort leak acceptance → maintainer
  sign-off; (3) loadSourceModuleImpl context divergence — needs Approach-B restructuring
  (follow-up); (4) loadSourceModuleImpl conversion declined with cause. Verification:
  repro PASS both configs (255 via diagnostics, was SIGILL 132, byte-identical output);
  1083/1083 + 688/688; CI green-triggered on final head. Worktree wt-slang-14474
  retained until the PR resolves.
- 16:04Z: triager **[Triage Resolution] CLOSED** — verified the GitHub footprint first:
  issue carries `reproduced` + Type=Bug + full comment trail (triage 6912544885 → fixer
  final state 6918339543 @ 13:51Z, which links the PR); its promised draft-PR delta
  comment was redundant → correctly not posted.

## Maintainer engagement (20:12Z–22:03Z)

- 20:12Z: **maintainer engagement** — lujinwangnv raised two Codex-sourced P1 concerns on
  PR #14501. Both answered (PR cmt 6927649999); concrete fix at new head **62912ccc0**:
  MSVC /EHsc unwinds destructors across longjmp, so the Consumed AbortRecoveryLock
  assertion fired on a legal path → Consumed case is now a documented no-op (release
  behavior was already correct); protocol comments name the per-compiler behavior and the
  accepted UB trade-off. Linux both-configs re-verified green; Windows CI running on the
  pushed head (no local Windows compile — stated honestly on the thread). **Parked in
  front of the maintainer: concern #2** — accept the documented longjmp trade-off vs
  pursue (a) owning-state registration (still UB on MSVC) or (b) standard-clean restructure
  of the imported-module error path to early-return (= triage Approach B, follow-up PR,
  changes both builds' diagnostics).
- 21:38Z: **maintainer inbound forwarded** — jkwak-work (real @nv-slang-bot mention, cmt
  6930146864, top-level): "I think we should comment out the `SLANG_BREAKPOINT`".
  Forwarded verbatim to the owning fixer session (pinned, in_reply_to=2 + thread_id,
  delivery verified as fixer seq 58); authorized to post on the issue. The line in
  question is handleSignal's no-exc `#else` (the PR's unguarded-path fallback); noted
  that the comment must not be read as deciding parked concern #2.
- 22:03Z: **direction applied** — breakpoint in handleSignal's no-exc fallback commented
  out at PR #14501 head **55ef7859e** ("core: terminate the no-exceptions signal path
  with a defined exit code"); reply posted to jkwak-work (cmt 6930743263): defined
  internal-compiler-error exit code (−2) instead of SIGILL/STATUS_BREAKPOINT + core dump;
  line kept visible for debugger re-enabling; handleAssert's debugger-conditional
  breakpoints untouched. Verified no-exc: AbortCompilation still escapes; non-Abort
  signal with escape installed exits −2 (was SIGILL 132, probe updated); repro 255;
  1083/1083 + 688/688 both configs. Two items disclosed for maintainer veto/preference:
  (a) mirrored change in reraiseAbortCompilation's no-enclosing-boundary tail, (b) labeled
  proposal to break only under an attached debugger (handleAssert pattern). ⚠️ Original
  triage acceptance criterion 4 ("internal errors still trap") is SUPERSEDED by the
  maintainer's direction — noted in the commit.
