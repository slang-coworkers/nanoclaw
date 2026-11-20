---
type: chain-record
title: "slang#14617 — slangc can't read/write 260+ char paths on Windows (longPathAware manifest)"
description: Chain state for the Windows long-path issue; PR #14622 (Part-of, deliberate) with pending Windows runtime verification and pre-agreed CreateFileW contingency.
tags: [slang, windows, max-path, long-path, manifest, pdeayton-nv]
---

# slang#14617 — slangc can't read or write files whose path is 260+ characters on Windows

HUMAN-filed 11-18 ~23:0xZ by pdeayton-nv (MEMBER, self-assigned — NOT a stand-down; collision
watch was clean: he filed no PR of his own). 👀 posted; dispatched to slang-triager at once on
canonical thread `gh-issue-shader-slang/slang-14617`.

**TRIAGED 23:15Z** (bug/medium/P2, core platform file I/O): root cause = Slang has zero
long-path support — no `\\?\` prefix anywhere and no application manifest, so Windows
`LongPathsEnabled=1` (registry, Win10+) is INERT for an exe without a per-app `longPathAware`
manifest. Gates: `FileStream::_init` → `_wfsopen` (slang-stream.cpp:180), `File::exists` →
`_wstat64` (slang-io.cpp:190), `Path::getPathType` (slang-io.cpp:646), `writeNativeText`
narrow `fopen_s` (slang-io.cpp:1225). Related but distinct symptom: #14612 (diagnostics
256-char truncation). Triage cmt 6994463835.

**TERMINAL our side 03:13Z 11-19: PR #14622** @ head `6f21946`
(https://github.com/shader-slang/slang/pull/14622, pr-mapping → fixer sess-1795043767016-ioz8i8,
explanation cmt 6995351927). Approach A only (+149, 4 files): new `cmake/slang-app.manifest`
(longPathAware), `slang_add_windows_manifest` helper in cmake/SlangTarget.cmake wired into
`slang_add_target`'s EXECUTABLE branch, examples/shader-coverage-backends explicit opt-in,
tools/slang-unit-test/unit-test-app-manifest.cpp guards (content + wiring + example opt-in on
every CI leg; Windows-only RT_MANIFEST/FindResourceW embed test in running slang-test.exe).
Contingency C (CreateFileW+FILE_FLAG_BACKUP_SEMANTICS for `File::exists`/`Path::getPathType`)
HELD BACK by design. Review: APPROVE_WITH_NITS round 3/3, all nits applied; declined-with-
justification: mt.exe CI step (bot App token cannot push .github/workflows — verified) and C001.

**Key subtlety — PR says "Part of #14617", NOT "Fixes":** the manifest fixes the write path
and CRT-open read path, but `File::exists`/`Path::getPathType` via `_wstat64` (UCRT stat may be
manifest-insensitive), `GetTempFileNameW`, and spawned third-party tools may stay MAX_PATH-bound.
**If the reporter's read repro still fails after merge, the pre-agreed follow-up is
CreateFileW+FILE_FLAG_BACKUP_SEMANTICS at slang-io.cpp:190/:646.**

Human actions outstanding: (1) pdeayton-nv Windows runtime verification on LongPathsEnabled=1
(both issue repro commands + mt.exe embed check) — asked on the PR; (2) maintainer merge decision;
(3) issue close deliberate manual. Reporter flipped the PR ready-for-review himself and requested
review — human owns the lifecycle now. Resume on PR/issue webhooks only.

**11-19 ~05:00Z — fixer infra bounces:** the fixer session (sess-1795043767016-ioz8i8) bounced
twice (03:49Z, 04:58Z, provider-class, 3rd death on the fixer group that night — operator
alerted on dashboard, thread fixer-provider-deaths-2026-11-19). No work lost; the PR is complete.
On fixer revival it still owes: explanation-comment refresh at head `46ac430` (comment 6995351927
still reflects `6f21946`), final critique re-record, and the [Fix Report] relay to slang-triager
(triager posted delta cmt 7000184051 on the issue meanwhile, so the GitHub trail is resumable).

**11-19 synchronize webhook (head `46ac430`, same head the fixer owes the comment refresh for):**
`pr_ready_for_review` reached Main; approver pause check ran (slang-pr-approver paused=1) →
NOT forwarded, queued in [data/approver-pause-queue.md](../../data/approver-pause-queue.md)
(#14622 entry; ledger decision owed on unpause). Further `pr_ready_for_review` events for
#14622 need no re-investigation — check the queue entry. Fixer work still owed on revival
unchanged.

**11-19 11:17Z — maintainer-direction round COMPLETE at head `c71a23cf6` (fixer reports ×2, Main-verified live).**
The fixer caught up (comment refresh etc.) and pdeayton-nv left two inline review comments, both
applied + answered: R1 manifest now uses the MS documentation's exact prefixed form
(`<ws2:longPathAware>true</ws2:longPathAware>`, confirmed byte-for-byte against
learn.microsoft.com's maximum-file-path-limitation sample) — commit `a48e04a48`, reply
r4627928828; R2 "not much value in this test, feel free to remove it" → the
appManifestIsDeclaredAndWired **source-tree guard test** removed (the file stays — it also holds the
Windows RT_MANIFEST embed test he didn't flag; whole-file removal is a one-commit follow-up if
wanted) — commit `c71a23cf6`, reply r4627929291. Main-verified: PR head `c71a23cf6` (open, NON-draft,
`pr: non-breaking`), both bot replies at 11:16:38/41Z on the reporter's 10:20/10:35 comments, CI run
44513378467 `waiting`. Master's 3 upstream commits (incl. compiler-files reorg) merged clean.
Deliverables current at head (PR body, explanation comment, issue delta); unit tests 686/686,
front-end 48/48, formatting clean. Supervisor-nudge resolution note: the 11:17Z nudge raced the
fixer's 11:00–11:16Z outbound; both asks were already answered — nudge closed, nothing redone.

**Awaiting (unchanged substance, one more human item done):** maintainer merge decision +
pdeayton-nv's Windows runtime verification (mt.exe embed check + both repro commands); Part-of
trailer keeps #14617 open until the repro is recorded; CreateFileW read-path follow-up pre-agreed
if the read repro still fails. Webhook-driven; no timers.

**11-19 17:38Z — reporter APPROVED the PR (Main-verified: review 5980203360, pdeayton-nv,
APPROVED, 17:38:47Z).** Both his review threads resolved, both asks applied; bot review side fully
complete (4 peer rounds + both human comments, all applied at head `c71a23cf6`); CI run 44513378467
re-triggered on that head. **Remaining human actions: the merge itself (maintainer's call — fixer
never merges) and the reporter's Windows runtime verification** (mt.exe embed check + both issue
repro commands); Part-of keeps #14617 open until the repro is recorded, with the pre-agreed
CreateFileW read-path follow-up if the read still fails. No blocker. Chain resting on
webhooks (merge event / issue comments).

**11-19 19:14Z — approval delta posted + CI triaged (fixer status; Main-verified artifacts).** Issue
status comment [6995361315](https://github.com/shader-slang/slang/issues/14617#issuecomment-6995361315)
updated 19:12:42Z to the approved state (review 5980203360, both threads resolved, both asks applied
@ c71a23cf6, remaining = merge + Windows runtime verification). CI on `c71a23cf6` — run
**44510682001** (Main-checked: in_progress): every build/test job green on all platforms, including
**test-windows-debug-cl-x86_64-gpu / test-slang SUCCESS** — the new Windows RT_MANIFEST embed unit
test compiled and passed on a real Windows runner, proving the embed pipeline end-to-end on CI.
**One failure, classified infra:** build-windows-release-cl-x86_64-gpu / build died downloading the
dawn WebGPU binaries — asset server (shader-slang/webgpu-dawn-binaries) returned HTTP 500; unrelated
to the change (same binary fine on other legs/earlier heads). The fixer reruns the failed job once
the run completes (infra-retry policy, ≤3 attempts). The run's `check-ci` failure row is the
pre-approval yield marker (failed 12:58:51Z, hours before the 17:38Z approval — by design; the
full-run rerun post-approval carries the real jobs). Run 44513378467 (yield-gate-only run) completed
with the expected marker failure and was already rerun. **No blocker for the merge decision**;
Windows runtime verification remains with the reporter (post-merge OK — Part-of keeps #14617 open
until the repro is recorded).

**11-19 19:34Z — infra retry in flight:** run 44510682001 finished (test-falcor done); the
dawn-500 windows-release build job re-run fired — **attempt 1 of 3**. All other legs green at
`c71a23cf6`. Next webhook decides: green → nothing outstanding before merge; red → retry 2/3 or
infra escalation. Merge = maintainer's call; acceptance item = reporter's Windows runtime repro
(Part-of trailer).

**11-20 01:55Z — MERGED (Main-verified: PR #14622 merged by pdeayton-nv at `c71a23cf6`,
01:55:43Z).** 4 bot peer-review rounds + both reporter comments applied; Windows CI proved the
embed end-to-end (RT_MANIFEST test green on a real Windows runner); the dawn-500 release-job flake
is moot post-merge. Worktree + sentinel cleaned up by the fixer; fix chain CLOSED. **Issue #14617
deliberately stays OPEN (Part-of trailer, Main-verified open) pending pdeayton-nv's Windows runtime
verification** (mt.exe embed check + both issue repros): close after the repro, or invoke the
pre-agreed CreateFileW read-path follow-up (slang-io.cpp:190/:646) if the read still fails.
No further bot action unless a new inbound lands on the issue/PR; webhook-driven.

