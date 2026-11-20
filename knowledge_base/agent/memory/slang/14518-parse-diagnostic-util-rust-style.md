---
type: chain
title: slang#14518 — slang-test ParseDiagnosticUtil can't parse rust-style diagnostics (SIMPLE_LINE slang-side errors always fail)
description: Bot-filed reproduced test-harness regression (from #10125, v2026.10). Fix in draft PR #14525 — round-1 rework pushed (head 591fb830 @ 08:01:45Z), 11:28Z [Fix Report] verified. Waiting on round-2 review (deliver gate needs codex CODE_REVIEW/OUTPUT_REVIEW; per-group codex quota) + CI run 44044228741 (queued since 08:08Z). 14:00Z recheck: nudge sent to try gate items now.
tags: [test-infra, slang-test, diagnostics, active-chain]
---

# slang#14518 — ParseDiagnosticUtil rust-style parse failure

**11-17 03:20Z, `issue_opened`.** Bot-filed (nv-slang-bot) after a coworker chain reproduced it; label
`reproduced`, no assignee. Distinct from held maintainer umbrella
[#14292](14292-slang-test-exit-code-all-test-types.md) (referenced in the body only — out of scope).

**Bug.** `SIMPLE_LINE` parses tool stderr with `ParseDiagnosticUtil`
(`tools/slang-test/parse-diagnostic-util.cpp` :111/:130/:228), which only knows the classic
`path(line): error N: message` format. Since #10125 (first shipped v2026.10) slangc renders
rust-style blocks unconditionally (`diagnose(D const&)` overload, `slang-diagnostic-sink.h:256-260`;
no flag restores classic), so `identifyCompiler` SLANG_FAILs and `runSimpleLineTest`
(`slang-test-main.cpp:3720`, fail branch :3746-3758) dumps raw stderr to `.actual` — any SIMPLE_LINE
test with a slang-side error can never pass. Only existing suite `tests/diagnostics/local-line.slang`
exercises downstream glslang lines, so it went unnoticed.

**Triage (slang-triager, 11-17 04:22Z).** Bug / regression / medium / P2, component test-harness.
Repro independently verified on fresh master da04f0426. Added `regression` label. 5-bullet posted on
the issue; memo (triage-14518.md) handed to slang-fixer on canonical thread
`gh-issue-shader-slang/slang-14518` (fixer session sess-1794889337639-05des4, group vmjrwe).

**Fix direction (triager-recommended).** Teach ParseDiagnosticUtil the rust-style format
(header `severity[EXXXXX]:`, location from the ` --> ` line, cross-line state). Alternative: consume
machine-readable TSV (bigger diff — follow-up direction). Flag-based approaches ruled out.

**State:** fix implemented — **draft PR #14525** "slang-test: parse rust-style Slang diagnostic blocks"
(head fix/issue-14518 @ 4e80c4bc, `pr: non-breaking`, jkwak-work auto-shepherd). Fix: record-style parser in
`tools/slang-test/parse-diagnostic-util.cpp` (header/location state machine, `_isSlangRichDiagnosticHeader`,
`_isSlangRichLocationLine`, rich-before-classic dispatch); 3 new regression tests
(`tests/diagnostics/slang-side-line{,-warning,-note}.slang`) fail on master, pass with fix; no production code
outside tools/slang-test (no collision with #14520). pr-mapping row routes PR webhooks to fixer session 05des4.
Explanation comment posted 06:44Z. **06:47Z [Report]:** all 4 triage acceptance criteria met (error/warning/note
SIMPLE_LINE tests pass; local-line 5/5; tests/diagnostics 1085/1085); full suite 12303/12322, zero diff-attributable
regressions (revert drill proved the 4 failures env-only). slang-reviewer verdict pending (~20-30 min), CI run
44033249212 on PR #14525. **07:48Z:** combined review verdict **REQUEST_CHANGES** — 0 bugs / 2 gaps /
1 question + 6 clarity items (Reviewer A retry2 + Devin + clarity; diff sha256 d8aba816c40e). Gaps: note test
asserts only the first record's line (note machinery unasserted; add companion SIMPLE filecheck pinning
`error[E30201]:` + `note:`), positionless-header flush paths untested. Question: bracketless `severity:`
headers in identifyCompiler (require `[E<digits>]` or document). High-conf clarity FG003: rich code stored
zero-padded vs classic Int — two representations. Devin flag: mixed diagnostics lose leading lexer errors
(:530). The reviewer reported to Main's edge, NOT the fixer — I forwarded the review file + distilled action
items to the fixer session (pin + thread_id + in_reply_to=62; delivery verified seq 22, 07:49Z). The reviewer's
07:48 verdict claims "Sent to: parent (slang-fixer)" but no such inbound had landed in the fixer session as of
07:52 — if it arrives later it's a harmless duplicate; the substance is already delivered. Verdict also flags
that the fixer's R4 self-check ("severities, E-codes, --> and --- — met") is contradicted by A's evidence.
**[Fix Report] pending on rework; ready-flip (regression exception) only after rework + CI green.**

**11-17 11:28Z:** round-1 feedback fully applied — 3 commits (261c283f clarity/naming no-behavior-change;
bae3b16c `requireCode` at identifyCompiler+dispatch, bracketless kept for notes, code normalized through Int
— resolves the bracketless question by tightening; 5a4a0e73 test renames rich-diag-*-line.slang + NOTECHK
stderr lanes pinning note machinery (proven non-vacuous) + rich-diag-positionless.slang covering both
positionless flush paths) on head 591fb830f, pushed (Main-verified live). Tests: 4 files pass, local-line
5/5+1, tests/diagnostics 1091/1091+10. Round-2 [Fix Review Request] deferred by codex 429s (critique-stage
re-records refused; deliver gate requires them) and CI run 44044228741 queued behind GitHub's runner backlog.

**11-17 12:32Z one-shot recheck (recheck-14518-fixer-roun-255c, sess-1794914967853-93854x):** no movement since 11:28Z —
fixer's last out is the 11:28Z [Fix Report] (no round-2 dispatch; its container was restarted 12:08Z with updated
instructions, inbound seq 26), CI run 44044228741 still `status=waiting`. Nudged once as directed: send id 9, pinned
target_session_id=05des4 + thread_id=gh-issue…-14518 + in_reply_to=**my-own-inbound-2** (the planned in_reply_to=74 doesn't
exist in a fresh task session — the auto-stamp hazard rule won; 11:21Z verified recipe used), delivered as fixer seq 28
12:32Z, asked: fire round-2 [Fix Review Request] + confirm CI unblocked, no re-sends. No 429 on the nudge itself. Further
escalation belongs to the hourly supervise-issues tick. Ready-flip (regression exception) additionally waits on CI green.

**11-17 08:54Z triager [Report] (verified by me).** Rework commits progressed to 08:01:45Z
(review-feedback rounds), no GitHub reviews yet — PR #14525 live-checked OPEN/draft @ 08:01:45Z,
matches. The 08:48Z fixer message was a generic provider-failure notice — the fixer session's 4th
visible failure since 04:43, part of the 08:48Z simultaneous multi-chain 429 wave (already escalated
by a sibling at 08:52, dashboard row 513560 — I added NO dashboard post, dedupe rule). NOT a work
stall. Triager PATCHed its issue comment in place ("fix in draft PR #14525, held pending
review/approval", remains last commenter) and armed one-shot recheck-14518-fixer-repo-fecd
(sess-1794905660378-1cldf3) for 11:15 UTC: report/PR progress → update only; frozen PR + no report
→ escalate as 2nd consecutive miss. Next milestone: fixer [Fix Report] after rework → reviewer
re-review → ready-flip.

**11-17 11:17Z 2nd consecutive miss → 11:21Z Main pinned wake.** Triager recheck (one-shot recheck-14518-fixer-repo-fecd,
reported to Main 11:17Z): PR still frozen (live-verified: OPEN/draft, 10 commits, head 08:01:45Z, 0 reviews, last comment
06:44Z); fixer last inbound 06:23Z, chat failure 08:48Z, no [Fix Report]. Main overrode the triager's "don't message the
fixer directly" stance (storm-conditioned): one pinned wake sent 11:21Z (send id 33, target_session_id=05des4 +
thread_id=gh-issue…-14518 + in_reply_to=my-inbound-2; delivery verified as fixer seq 24) — asked it to process the parked
07:49Z REQUEST_CHANGES verdict (2 gaps + 1 question), push rework, send [Fix Report]. Dashboard: deduped addendum posted
11:21Z to the open provider-stability incident; restart ask deferred to the recheck. One-shot `recheck-14518-post-wake-9d0a`
(12:45Z, Main group, sess-1794914480920-94skr4) decides: progress → verify + stand down; wake unprocessed/failure notice →
restart request for slang-fixer/sess-1794889337639-05des4 on the dashboard, no further wakes.

**11-17 12:45Z one-shot recheck (recheck-14518-post-wake-9d0a, sess-1794914967853-…): branch (a) — wake was processed, restart ask CANCELLED.**
Live verification: PR #14525 still OPEN/draft @ head 591fb830 (08:01:45Z, no commits since), but the 11:21Z wake was
answered — fixer [Fix Report] 11:28Z (fixer seq 29; Main chain afblt5 seq 74): round-1 rework fully applied + pushed, all
claims live-verified (commits 261c283f/bae3b16c/5a4a0e73 + merge 591fb830 present on the PR; 0 GitHub reviews yet; last
comment 06:44Z). Fixer session is healthy — the 08:48Z canned failure predates the wake and its post-wake behavior is
normal. Remaining blockers are external: round-2 [Fix Review Request] deferred by the critique-provider 429 outage
(already escalated fleet-wide on the dashboard 12:28Z re #13833 — deduped here), and CI run 44044228741 still
`status=waiting` on 591fb830 (queued since 08:08Z, GitHub runner backlog — >4.5 h). No response yet to the 12:32Z nudge
(13 min old; fixer container restarted 12:08Z, turn may be in flight) — per the 12:32Z recheck, further escalation
belongs to the hourly supervise-issues tick. One-line delta posted to orchestrator-dashboard (restart question closed).
Next milestone unchanged: round-2 review → ready-flip (regression exception, needs CI green).

**11-17 14:24Z: round-2 [Fix Review Request] OUT.** The 14:00Z recheck nudge landed in an open window: all
three critique stages recorded approve (PLAN_REVIEW 01a1e9d0 item-mapping verified; CODE_REVIEW 01a1e9d4
independently reproduced 9/9 lanes + 1091/1091 category; OUTPUT_REVIEW 01a1e9df PR body byte-verified, head
three-way-matched 591fb830f), and the r2 request went to slang-reviewer (fixer msg 33) with the item-by-item
self-check + two CODE_REVIEW advisories forwarded for conscious close. CI still waiting (dispatch queue not
draining — infra, not code).

**11-17 14:44Z: round-2 verdict = APPROVE_WITH_NITS.** (A: 0 bugs / 7 gaps / 1 question 🟡; Devin fresh at
591fb830f, 2 bug titles — "Standalone checkpoint diagnostic rejection" :501, "Mixed diagnostics lose leading
lexer errors" :577; C: 16 clarity candidates, strongest = multi-line-header location loss: newline-bearing
internal-error formats flush the pending record positionless and demote the real ` --> ` location to a note.
Diff sha256 1c6bc2478a88.) Review reported to Main's edge again — relayed to fixer session with distilled items
(pin + thread_id + in_reply_to=90; delivery verified fixer seq 32 @ 14:45Z): conscious close on C's multi-line
item + Devin's 2 titles, discretionary comment fixes, then [Fix Report]; ready-flip waits on that + CI.
**11-17 16:10Z [Fix Report] — accepted; flip CONFIRMED conditional on CI green.** All round-2 nits applied at
head 529c20fc7 (15 commits; multi-line buffering adopted per C002; requireCode note carve-out + Int code
normalization — an internal CODE_REVIEW caught a release-mode SLANG_ASSUME side-effect trap in the assert form;
7 comment/coverage fixes; CKPT/CLILOC/PERF lanes; tests/diagnostics 1094/1094+10; all lanes pass Debug+Release).
Devin title 1 was REAL — a regression the fixer's own round-2 requireCode introduced (codeless standalone
checkpoint notes stopped identifying), probe-proven and fixed (CKPT lane discriminates). Devin title 2
(mixed-stream) = documented non-bug, demotion comment corrected. Glyph duplication answered INTENTIONAL
(literals + citation comment = drift guard). Parsed-output observability deferred with justification to a
SLANG_UNIT_TEST follow-up. Main verified live: head 529c20fc7, CI run 44117444565 waiting since 15:42Z
(dispatch queue still wedged — supervise tick + dashboard own that). **Flip authorized: fixer flips on CI
green (no further confirm; if its spine refuses `gh pr ready`, Main flips).** Side-find authorized: E99997
debug-slangc abort on the -report-checkpoint-intermediates family (slang-emit-c-like.cpp:108,
reproduced on trivial compute) — fixer to FILE it (dup-search clean, no operator go-ahead needed per filing
policy), filed-only, no triage/fixer dispatch (operator's call). Next: CI green → flip → chain Terminal
(merge is the shepherd/maintainer's action).

**11-17 16:16Z wrap-up:** E99997 filed as
[#14553](14553-e99997-checkpoint-flag-abort.md) — Main live-verified the filing; scope CORRECTED at filing
time: only `-report-checkpoint-intermediates` triggers (the review's original claim that
`-report-perf-benchmark` also triggers was wrong — clean on the same Debug build); 0-line diff vs master
818012112 → pre-existing, not introduced by #14525. Filed-only; reported to operator (dashboard msg 117);
its issue_opened webhook is a self-echo — no triage dispatch. Flip armed, held on CI run 44117444565 (queue
re-wedged after briefly draining; fixer not polling; flips on the CI webhook, will ask for Main-side flip if
its gates refuse). SLANG_UNIT_TEST on parseSlangRichDiagnostics remains the recorded build-graph follow-up.

**11-17 12:57Z fixer [Report]: per-group codex quota + dispatch-queue facts.** PLAN_REVIEW re-approved + recorded
(thread 01a1e984, verdict approve at HEAD 591fb830f); CODE_REVIEW/OUTPUT_REVIEW refused 3× by the codex bridge
(429 exceeded-retry-limit). Pattern: one success per window then quota closes — per-GROUP budget (other groups'
windows open), NOT cost-cap (Main live-verified: session ok $14.21/$180) and NOT the fleet wave — operator-only fix
(raise/reset slang-fixer codex quota). CI: run 44044228741 waiting since 08:08; workflow_dispatch queue not draining
AT ALL (sibling runs 10:27/10:28/11:32/11:59 all queued; only pull_request-event runs execute, as skipped-for-draft);
fixer not re-dispatching (avoid dupes). Dashboard delta posted 13:0xZ (msg 87; distinct from the 12:03 SM80Plus
merge-queue alert). Next one-shot recheck `recheck-14518-fixer-code-cf2f` fires 14:00Z (nudge → try
CODE_REVIEW/OUTPUT_REVIEW + round-2 dispatch; in_reply_to=80). Remaining sequence once quota opens: CODE_REVIEW →
OUTPUT_REVIEW → round-2 dispatch → verdict → [Fix Report]; ready-flip then waits on CI only.

**11-17 14:00Z one-shot recheck (recheck-14518-fixer-code-cf2f, sess-1794920309636-lsht6e): still gated → nudge sent.** Fixer's
last out is the 12:57Z [Report] (no round-2 dispatch, no new gate progress; PLAN_REVIEW remains its only recorded gate item), CI
run 44044228741 live-checked `status=waiting` (unchanged since 08:08Z). One nudge sent as directed: send id 9, pinned
target_session_id=05des4 + thread_id=gh-issue…-14518 + in_reply_to=**my-own-inbound-2** (the planned in_reply_to=80 doesn't exist in
a fresh task session — same 12:32Z recipe), delivered as fixer seq 30 @ 14:01Z, no 429: try CODE_REVIEW/OUTPUT_REVIEW at HEAD
591fb830f now (window may be open), then round-2 dispatch, re-check CI pickup once, no re-dispatch if still queued, report and stop
on further 429s. Further escalation belongs to the hourly supervise-issues tick; ready-flip (regression exception) waits on
round-2 verdict + CI green.

**Infra history (11-17):** fixer stalled 04:43–06:23 in the fleet-wide fixer burst (≥15 sessions minted
04:22–05:58 saturating provider rate limits; NOT cost-cap — live session ok $4.72/$180; the stopped yiuh5a
is an old unrelated session). Dashboard: sibling's consolidated 06:25 escalation + my cost-cap-ruled-out/burst
addendum (msg 57). Fixer recovered ~06:44 and delivered. Triager's re-check t-74f064 (08:00Z) should stand down
on seeing the PR. Verify claims against live GitHub state before relaying — on 11-17 the triager's post/handoff
landed ~33 min after its report raced my first check.
