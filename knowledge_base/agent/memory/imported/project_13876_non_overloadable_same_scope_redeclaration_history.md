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

**10-28 11:36Z, MAINTAINER REQUEST_CHANGES** (skiminki-nv, review
[5681967676](https://github.com/shader-slang/slang/pull/13880#pullrequestreview-5681967676); Main read it live). The
direction is confirmed: the 18 new tests pass on their debug build with no regressions. The review lists 6 requests:
1. Pair buffer members with their block through the variable's type (`ConstantBuffer<SLANG_ParameterGroup_CB>`), not by
   member order.
2. Run the buffer-member pass once per container, not from the first transparent variable's visitor. This removes the
   `__generic` unit test and the either-outcome language-server test.
3. Mark the unscoped-enum alias in `CompleteDecl` (a modifier or a field), not in `isUnscopedEnumCaseAliasOfOwnEnum`.
4. In the process report, explain why replaying only the redeclaration check in `ensureDecl` is enough, compared with not
   skipping ReadyForReference in `checkVarDeclCommon`, and describe the `__optInner` cascade.
5. Shorten the comments, and note that 202c may change (#13956).
6. Use the five-part PR description, with input-shape answers for requests 1–4.
The review also asks the PR to state that severity depends on order (`static const a; enum{a}` gives W30204, the
reverse gives E30200). W30203 is accepted.
At 11:40Z the fixer posted a TODO acknowledgement ([6468031899](https://github.com/shader-slang/slang/pull/13880#issuecomment-6468031899)),
head still `8fa442147`, and started a design pass on 1–3.
**Conflict:** request 6 against our fleet PR-description gate (1,000 characters, 2 lines per section). The fixer
proposed a short five-part description plus the full process report in the explanation comment, and telling the
maintainer. Main told the fixer to proceed with that, and asked the operator whether to lift the gate for #13880.

**10-28 13:46Z, R6 REWORK PUSHED** (fixer; Main checked live). Head `69255c6c3` (21 files +1224/−12, 33 commits, no
force-push, `pr: non-breaking`). Requests 1–5 are done:
- buffer members are paired through the transparent variable's checked type;
- one pass per container, including `visitBlockStmt` for function bodies;
- the `__generic` guard, its unit test and the either-outcome LS test are removed;
- `UnscopedEnumCaseAliasModifier` is set in `CompleteDecl`;
- comments are shorter, with the #13956 note.
Request 6 is partial. The PR body (1117 characters including the disclaimer and the Fixes line) has the five parts in
short form, with one-line input-shape answers and the order-dependent severity. The full report is in the explanation
comment, and the TODO reply 6468031899 was edited in place to say where it is.
Fixer's local runs: slang-test 11156/11159 and static 61/0.
Peer R6: round 1 REQUEST_CHANGES (function-local buffers lost the warning; fixed), round 2 had 0 findings. Both rounds
were **lead-only**: reviewers A and C did not run, and B cannot run in patch mode.
CI: pull_request 40697449182 waiting for environment approval; formatting passed.
Waiting on skiminki-nv's re-review, and on the operator's gate decision (a: keep, the default; b: lift for #13880).

**10-28 15:48Z, APPROVED** by skiminki-nv ("LGTM", review
[5685541303](https://github.com/shader-slang/slang/pull/13880#pullrequestreview-5685541303), on `69255c6c3`). Main checked
live: mergeable is MERGEABLE, but mergeStateStatus is BLOCKED and reviewDecision is null, so another required approval
(likely a code owner) and/or the queued CI job is still missing. Run 40697449182 had 44 jobs succeeded and 1 queued. The
approval did not ask for the full process report in the description, so the operator gate question is **moot for #13880**
and has been dropped from the re-check. No pr-approver was routed (both are paused). Next: a human merge.
**10-28 15:50Z:** skiminki-nv asked "@nv-slang-bot Confirm that this PR contains all intended commits." (6473677315). The
fixer confirmed in [6473705773](https://github.com/shader-slang/slang/pull/13880#issuecomment-6473705773): 33 commits,
`a391ff0`..`69255c6`, matching its local branch one-to-one, with no other work, and 21 files against base `e485e7861`.
Master is 25 commits ahead with no conflicts; the fixer offered to merge master but did not. Main checked live: 33 commits,
still BLOCKED, reviewDecision null, not merged. This looks like the maintainer preparing to merge.

**10-28 16:24Z, REWORD AFTER APPROVAL** (fixer; Main checked live). skiminki-nv had **added #13880 to the merge queue
at 15:51Z**. The PR was 25 commits behind master at that point, so being BEHIND does not block queueing. At 16:14Z they
removed it from the queue and left an inline suggestion
([r4403168398](https://github.com/shader-slang/slang/pull/13880#discussion_r4403168398)): "declaration of '~decl'
conflicts with existing declaration (allowed for compatibility)". The fixer applied it in `ae2249915`, one
message-only commit, 34 commits total, and replied in the thread (r4403210114, left unresolved).
⚠️ That push **dismissed the approval**. The timeline shows `review_dismissed` at 16:23:28Z, because the repo dismisses
stale approvals. The state is now reviewDecision null and mergeStateStatus BEHIND. The fixer's report did not mention
the dismissal. Main told the fixer: no further pushes, and no master merge unless asked. Next: skiminki-nv re-approves
and re-queues.

**10-28 16:31Z, RE-APPROVED** by skiminki-nv: "LGTM if CI passes" (review
[5686166855](https://github.com/shader-slang/slang/pull/13880#pullrequestreview-5686166855), on `ae2249915`). Main checked
live: reviewDecision null, BEHIND, not merged. The commit's check-runs show 16 success, 13 in progress, 3 queued, 1
waiting. **2 are FAILED: `check-ci` and `wait-for-human-priority` from the fixer's own workflow_dispatch run
40725539917**, the usual bot priority-yield. The fixer's report said "no check has failed yet", which was wrong again.
On a non-draft PR the pull_request run already gives CI, so a bot dispatch only adds red `check-ci` rows on the head. Main
told the fixer to stop dispatching on #13880 and to report those rows correctly. Next: CI finishes, then skiminki-nv
re-queues.

**10-28 18:52Z, CI GREEN** on `ae2249915`. pull_request run 40725494846 finished with success. Main checked live: the
PR's **statusCheckRollup state is SUCCESS with no bad contexts**. The rollup takes the latest result per name, so the
yielded dispatch rows don't show on the PR. mergeStateStatus is BLOCKED and reviewDecision null. It was BLOCKED in the
same way at 15:51Z, when skiminki-nv merge-queued it anyway, so BLOCKED does not stop a maintainer from queueing. Branch
rulesets list no review or check rules; classic protection isn't readable from here.
The fixer offered three options. **Main chose (a): no action**, meaning no dispatch rerun and no PR note. skiminki-nv's
"LGTM if CI passes" condition is met. Next: skiminki-nv re-queues.
