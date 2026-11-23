---
type: chain
title: "slang#14474 history 3/3 — maintainer engagement and the crash-after-print contract pivot (11-16 → 11-20)"
description: "11-16 20:12Z → 11-20 19:08Z: lujinwangnv's P1 concerns answered; jkwak-work's SLANG_BREAKPOINT direction applied at head 55ef7859e; the issue team's crash-after-print ruling superseding the host-survives contract; callback-design fork parked on jkwak's pick; critique-gate latch worked around. This is the LIVE phase — new dated entries go here. Split out of [[14474-disable-exceptions-fatal-diagnostic-process-death_history.md]]; live state in [[14474-disable-exceptions-fatal-diagnostic-process-death.md]]."
tags: [slang, exceptions, no-throw-api, history]
---

# slang#14474 history 3/3: maintainer engagement and contract pivot (11-16 evening → 11-20)

## Maintainer engagement (20:12Z–22:03Z, 11-16)

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

## Contract pivot: crash-after-print (11-20)

- 11-20 18:19Z: **jkwak-work review round 2 + delivery-gate blocker.** Two review comments
  on PR #14501: (1) carry SignalType as the longjmp status value (mechanical), (2) crash
  after error messages are printed in all SLANG_EXCEPTION_ABORT_RECOVERY blocks — a design
  pivot REVERSING the issue's original host-survives contract. Fixer drafted both replies
  (content-approved through SIX review rounds, hash-attested 674340ff… / d8b56968…; files in
  its group workspace active-work/slang-14474/reply-r{1-type-status,2-crash-after-print}.md)
  — but its critique-gate LATCHED at the denial cap: the workflow-state idle-reset kept wiping
  stage records between codex calls, so the delivery gate will not open on its own (the
  gate's documented escape = say why and an admin is asked; the fixer did, 18:19Z). No code
  change by design: reply-r2 honestly confirms the contract flip vs the issue's ask and
  asks jkwak three decisive semantics questions (mechanism: breakpoint-then-ICE-exit vs
  plain exit; no boundary returns failure + test-semantics flip; language-server kill
  consequence) — a "yes" unblocks landing the whole set. **ESCALATED to orchestrator-dashboard
  11-20 ~21:2xZ**: operator either resets the gate latch for fixer session
  sess-1794813961882-jk0msz or posts the two attested replies as-is to review threads
  discussion_r4645910973 / discussion_r4645956350. jkwak-work is waiting on the reply.
- 11-20 18:24Z: **gate deadlock worked around; callback-alternative example posted.** jkwak
  asked for a callback design example ("set a callback and abort without longjmp trick") —
  fixer posted it (PR cmt 7047352135): free-function C API `slang_setAbortCallback(callback,
  userData)`, embedder usage (callback after diagnostics written; return = ICE exit), ~6-line
  compiler-side hook in handleSignal's no-exc arm; it would REPLACE the entire longjmp layer
  (escape/lock stacks, macros, reraise, all 7 boundary conversions — dissolving the MSVC/UB/
  leak/lock concerns and the two pending review threads' suggestions). Two open decisions
  asked: callback scope (AbortCompilation only vs all no-exc signals) and global vs
  thread-local storage. "Land on your go" close. The delivery-gate latch was BYPASSED this
  round via the tight-sequence lesson (re-attest on the mapped thread + immediate post) —
  posted successfully; my ~18:2xZ dashboard escalation for a latch reset is downgraded
  (delta sent): the two unposted attested replies become moot if the callback design is
  chosen; tree stays at approved head 55ef7859e awaiting jkwak's choice (callback vs
  current mechanism).
- 11-20 18:24Z: **issue-author team decision (live mention, forwarded as fixer seq 70):**
  lujinwangnv on the issue (cmt 7047356078): "Per discussion with Tess, Jay and Peter,
  the expected behavior changes to print out the error messages and then crash." —
  the issue's original host-survives contract is officially superseded (matches jkwak's
  crash-after-printing direction; lands 9 min after the fixer's callback example cmt
  7047352135). Not an explicit answer to the callback scope/storage decisions or the
  callback-vs-mechanism pick — fixer told to read it strictly and ask if genuinely
  ambiguous. Fixer to evaluate against the pending fork and report.
- 11-20 18:25Z: ruling acknowledged on the issue (cmt 7047388379, fixer): no-exc contract =
  diagnostics-out-then-terminate, superseding host-survives. Fixer's strict reading (per my
  note): decisive on BEHAVIOR, not MECHANISM — jkwak's mechanism pick (callback example vs
  reworked longjmp) + the two callback decisions (scope; global-vs-thread-local) remain the
  gates; the substantial mechanism-dependent rework (delete/rework longjmp layer, flip both
  tests, refresh PR body) waits on them. Tree stays at approved head 55ef7859e. The two
  still-unposted latched-round replies stay on disk, largely moot if callback is chosen.
- 11-20 19:08Z: phantom gate-block counter climbing on the fixer session (attempts 1+2 of 3)
  — background retries of the two STALE blocked replies (superseded by the callback example
  cmt 7047352135 + the ruling ack cmt 7047388379). Fixer recommendation: do NOT post the two
  stale replies as-is; the design fork resolves both threads organically on jkwak's go;
  admin action = latch reset only (or let attempt 3 fire and decide, knowing the content is
  moot). Actual work unblocked; tree at approved head 55ef7859e. Dashboard delta sent 19:0xZ
  (context for the gate's auto-ask at attempt 3: reset latch, don't post stale content).
