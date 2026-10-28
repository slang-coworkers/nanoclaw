---
type: project
name: project_13876_non_overloadable_same_scope_redeclaration_history
description: "Dated history of the slang#13876 / PR #13880 redeclaration-diagnostic chain (10-22 18:22Z → 10-27 10:43Z): routing, summons, triage, draft PR, both maintainer decisions, the Falcor red, the in-place update. Split from project_13876_non_overloadable_same_scope_redeclaration on 2026-10-27; new dated entries append here."
---

# slang#13876 / PR #13880: dated history

Current state, decisions and lessons: [[project_13876_non_overloadable_same_scope_redeclaration]].
Every entry was checked live by Main unless it says otherwise.

- **10-22 18:22Z, `issue_opened`.** OPEN, 0 comments, no labels; author skiminki-nv (MEMBER),
  self-assigned, parent = umbrella #13719. Only my webhook session `sess-1792693340132-gh8h38` on the
  canonical thread. R6 gate nanoclaw#1993 still a draft, so routing unchanged.
- **18:24Z** dispatched to slang-triager `sess-1792693495093-68uevm`.
- **18:25Z, summons** (issue comment 6348134538, "Please reproduce and propose a PR"). Forwarded
  verbatim to the triager with `<github-post-authorized />`.
- **18:37Z, TRIAGED** (comment 6348371268, label `reproduced`; memo
  `/workspace/agent/reports/triage/triage-13876.md`, reproduced at `e485e7861`). Handed to slang-fixer
  `sess-1792694206953-sgt9at`.
- **21:06Z, DRAFT #13880** @`ce9d91323` (8 files, `pr: breaking change`; issue delta 6351304001).
  E30200 for all three cases in both orders. 21:08Z the triager corrected its "0 CI failures" claim
  (it came from `gh pr checks`); no GitHub post had made it.
- **10-23 00:17Z, TRIAGE RESOLUTION** @`776bfc5d9` (12 files). R1+R2 REQUEST_CHANGES, all applied, fixer
  at its two-round cap. Two-part question to skiminki-nv in PR comment 6351291733. Fixer found 3
  pre-existing bugs and did not file them (operator decision opened).
- **10-23 10:08Z, DECISION 1** (PR comment 6362500485): cbuffer/tbuffer "a hard error, follow DXC";
  `enum Mode { Mode, Other }` a warning in all versions incl. 202c. Fixer pushed `4365b25af`.
- **11:57Z, resolution updated** @`174a0319b` (15 files): new W30203; reviewer APPROVE_WITH_NITS applied.
  DXC divergence `cbuffer CB { Light Light; }` put to skiminki-nv in 6351304001.
- **13:24Z, READY** (skiminki-nv, review requested). `test-falcor` failed on both attempts of run
  39960878492 (GitLab 76144253, 76164426; log host unreachable). The fixer compiled all 441 public
  Falcor `.slang` files on master vs PR: 0 diagnostic differences. Log check requested in PR comment
  6377443007. A supervisor nudge at 10-24 00:14Z caught the fixer waiting for a rerun webhook.
- **10-26 18:00Z, `pr_mention` HELD**: jhelferty-nv "Tagging @tangent-vector" (6423554295), no bot mention.
- **10-27 07:14Z, Falcor green**: babysitter re-ran the build job (attempt 4; job 122046181481). The red
  was the #13725 outage (closed 10-26 18:12Z). 07:21Z the fixer edited 6377443007 to withdraw the log check.
- **09:04Z, DECISION 2** (issue comment 6437822891, no bot mention): warning, not error, in 2018–2026;
  #13956 tracks 202c lookup/overload. Forwarded verbatim to the fixer (issue comments do not route via
  the PR mapping). **09:06Z summons** (6437859155: update #13880 or replace it), forwarded with
  `<github-post-authorized />`. **09:15Z** fixer reply 6438037669: update in place, 2 questions open.
- **09:47Z, UPDATED IN PLACE** @`60b856b4e` (18 files, not force-pushed), label → `pr: non-breaking`.
  Correction to my 09:05Z note: `{ int a; let a = 1; }` is accepted by master, so it is now a warning.
- **10:43Z, FIX REPORT** @`d21e20c3b` (19 files +1178/−12, 21 commits): explicit
  `RedeclarationSeverity` per site, W30204 text names the 202c error, user-guide 202c entry. R4
  APPROVE_WITH_NITS, nits applied. pull_request run 40488632185 past the priority gate; the bot's
  workflow_dispatch run 40488648215 "success" skipped build/test.

**10-27 12:03Z:** the triager's 10-23 [Triage Resolution] and its issue status comment 6351304001 (last edited 10-23
11:57Z, still describing `174a031` and a hard error) are stale. It had not received the fixer's 10:43Z [Fix Report],
which came to Main. Main relayed the Fix Report and cleared the triager to edit 6351304001 in place, with no new comment
and no @-mentions, and then send an updated Resolution. CI run 40488632185 @ `d21e20c3b` had 41 success, 0 failed,
`test-windows-debug-cl-x86_64-gpu / test-slang` still in progress, and the falcor approval gate waiting.
**10-27 12:04Z:** the triager sent an updated [Triage Resolution] that replaces its 10-23 one. It edited 6351304001 in place
to describe `d21e20c` and posted no new comment. Main checked this live. The triager set no re-check of its own, so mine
covers it. The chain is unchanged: parked on skiminki-nv's 2 answers, human review, and the Falcor gate.

**10-27 14:57Z, BOTH QUESTIONS ANSWERED** by skiminki-nv (issue comment
[6445312525](https://github.com/shader-slang/slang/issues/13876#issuecomment-6445312525); Main checked live, matches
the payload). The comment does not mention the bot, but it answers the bot's question on the PR they asked for.
(1) 202c: "Treat 202c the same as 2018–2026 for now. We'll deal with 202c later as part of #13956."
(2) Errors that exist today: "Keep these as errors."
Taken together: W30204 in every version, including 202c; master's E30200 cases unchanged. The fixer had not seen the
comment (its last row was 10:43Z), so Main forwarded it verbatim to `sgt9at` on the canonical thread. The head was
`d21e20c3b`.

**10-27 15:27Z, ANSWERS IMPLEMENTED** (fixer; Main checked live). Head `c2fb1a394` (17 files +1071/−12, 24 commits, no
force-push, `pr: non-breaking`). W30204 now fires in every version, 202c included. Master's E30200 is unchanged and W30203
is unchanged. The 202c clause is removed from the message and comments. The user-guide 202c entry is removed. The
202c test is folded into `redeclaration-language-version.slang`. Fixer reports slang-test 11153/11156 locally and 62/0
static. check-formatting failed at the intermediate commit 9d73660, because local `formatting.sh` skipped clang-format:
the binary is named `clang-format-17`. It passes at `c2fb1a3`. The issue delta comment is 6446000881, with no @-mentions.
pull_request CI 40531081020 is pending. A delta peer review has been requested. Next: human review only. No open
maintainer questions remain.

**10-27 16:55Z, FIX REPORT after R5** (fixer; Main checked live). Head `8fa442147` (19 files +1181/−12, 27 commits, no
force-push, `pr: non-breaking`). slang-reviewer R5 gave APPROVE_WITH_NITS, and all requirements are met.
The R5 fixes:
- a buffer variable with no element struct before it, made through user `syntax` modifiers, is now an ordinary direct
  member, which removes a reachable E99997 assert;
- the module's own `module` declaration no longer hides W30204;
- 3 coverage tests were added.
Not taken:
- the producer link, because it would change a serialized AST modifier;
- the optional "rename one of the declarations" wording.
The fixer's local runs: slang-test 11155/11158 (3 fp8-cuda failures that also fail on master) and static 62/0. Its
revert drill showed both new R5 tests fail without the fix.
CI: pull_request run 40544338814 pending, formatting queued. No human review yet.
