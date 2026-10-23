---
type: project
name: project_13591_ai_contributor_standards_batch
description: "slang#13591-#13602 (szihs, 10-13 11:07Z): 12 self-assigned issues filed in ~15 s, a parent 'Contributor standards for AI coding assistants' tracker plus R1-R10 rule sub-issues, each backed by a szihs PR (e.g. #13593 -> draft #13585). Maintainer-owned process work, nothing asked of the bot -> held: NO dispatch, NO bot post. R6 (#13596) itself says the bot should wait on human-filed issues."
metadata:
  node_type: memory
  type: project
---

# slang#13591 batch: contributor standards for AI coding assistants

**10-13 11:07Z, 12 `issue_opened` webhooks in ~15 s**, each minting its own Main session on its canonical thread
(`gh-issue-shader-slang/slang-135NN`). Author **szihs** (human), every issue self-assigned, 0 labels, 0 comments.

- #13591 parent tracker: ten rules, warn-mode first, adopt after a replay-harness eval (#13602).
- #13592 R1 PR description · #13593 R2/R3 comments · #13594 R4 one review workflow · #13595 R5 AI disclosure ·
  #13596 R6 bot skips newcomer issues, waits 4 days on human issues · #13597 R7 docs · #13598 R8 simple English ·
  #13599 R9 label/hide bot items · #13600 R10 Discord threads · #13601 shorter reviews · #13602 replay-harness eval.
- Each sub-issue's "Done when" names a szihs PR (#13593 -> **#13585**, draft, `authorship/r2-comment-standard`,
  "State the comment standard and its reviewer test"). Earlier same-day drafts #13587-#13589 overlap R7/R9/shorter reviews.

**Disposition (#13593 session, sess-1791889630023-dvu1vs): held, nothing dispatched or posted.** Same class as the
#13550 / #13498 / #13457 holds ([[project_13550_intrinsic_annotation_application_policy]]): a maintainer filed and
self-assigned process work, owns the PR, and asked the bot for nothing. A triage pass or bot comment would be exactly
the "bot items bury human work" problem #13591 is about, and R6 states the bot should wait on human-filed issues.

**Downstream impact to expect.** R2/R3 (#13585) adds three candidate classes to the slang fine-grained clarity skill
(narrating comment, process residue, terminology without precedent); R6 (#13596) changes the nanoclaw `nv-main`
webhook gate. Both touch our own coworkers once merged.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. A mention arrives as a webhook, so no
re-chase timer.

## R6 (#13596), 2026-10-13 (#13596 session sess-1791889636363-cj4b42)

Held like the rest of the batch: no dispatch, no bot post. Unlike R1 (#13584) and R5 (nanoclaw #1991/#1992), R6 has
**no PR yet**, and no open slang-coworkers/nanoclaw PR builds the gate. The labels `no-bot` and `bot-ok` don't exist
on shader-slang/slang, and 6 issues carry `GoodFirstBug`. **Pending operator decision:** does Main send the gate (4-day
defer on human-filed issues; skip `GoodFirstBug`/`HelpWanted`/`no-bot`; pass `bot-ok` or a crash with a reproducer) to
a nanoclaw builder, or does szihs build it? Until then routing is unchanged; the 4-day defer is not applied by hand
because #13591 says every check starts in warn mode. Re-check task armed for 10-18 12:00Z.

**10-18 12:00Z re-chase (task `rechase-13596-r6-gate-f5e7`): the pending decision is moot, szihs builds the gate.**
slang-coworkers/nanoclaw **#1993** "feat: the bot leaves room for people on new issues (R6)" (szihs, **draft**,
`authorship/r6-issue-bot-gate`, created 10-13 11:42Z, last updated 10-14 09:35Z, 0 reviews/comments). It touches
`src/config.ts`, `src/github-webhook-server.ts` and `src/webhook-github{,.test}.ts`. `deliverGitHubIssueOpened` never
delivers issues labelled `GoodFirstBug`/`HelpWanted`/`no-bot`. It parks a fresh human-filed issue behind a one-shot
re-check after `ISSUE_BOT_WAIT_DAYS` days, and delivers at once for `bot-ok` (`issues.labeled` is now accepted), a
bot filer, or a crash/regression with a fenced reproducer. **Prod needs `ISSUE_BOT_WAIT_DAYS=4` in `.env`**: the
default `0` keeps today's behavior, so merging alone changes nothing. Correction: the 10-13 line "no open
nanoclaw PR builds the gate" was written before or without noticing #1993, which opened 35 min after the issue.
Live state at 10-18: #13596 is OPEN with 0 comments and 0 labels. The labels `no-bot`/`bot-ok` still 404 on
shader-slang/slang. No message sent. **Next:** nothing is due from Main. When #1993 merges, the `.env` flag and
creating the two labels are operator/szihs steps. Resume only on a webhook or an operator ask.

## R10 (#13600) prod audit, 2026-10-13 (read-only, #13600 session sess-1791889641831-376bet)

Two scheduled tasks post to #slang-committers (`1352357976878481468`). Both belong to **Slang Maintainer
`slang_maintainer` (ag-1776713258088-r8pp2t)**. Main's `ncl tasks list --all` can't see them; find them through
`ncl sessions list | grep system:tasks` and the group's main-session task inbounds.

- **`slang-pr-report-committe-83e0`**, cron `0 5 * * 1`, session sess-1784649577276-u80by6. **This is the 1/N
  source.** Its STEP 3 tells the agent to split into ≤1900-char chunks and prefix each one "(part k/N)", and
  `thread_name` is ignored on a text channel. Posted 2/2 every Monday from 09-07 to 10-12 and 9–10 parts in
  August. The title line drifts between posts. Next fire is 10-19 05:00Z.
- **Rotation ask**, Mondays 12:00Z, acts every 14 days from the 06-22 anchor, runs in main session
  sess-1776713576419-eq0811. Single post with a disclaimer, so it already complies. Next ask is 10-26.
- slang-discord-support replies inside forum threads. No 1/N posts in its last 200 rows.
- **Dependency:** a thread on a text channel needs `discord_create_thread`, from slang-coworkers/nanoclaw#1672
  (jhelferty-nv). That PR has been a draft since 09-21.

The audit went to the operator only. Nothing was posted to GitHub and nothing was dispatched, per the batch hold above.

**10-18 12:03Z re-chase (rechase-13600-r10-pr-rep-9fef): both decisions still open, reminder sent** (orchestrator-dashboard
msg 37, thread `gh-issue-shader-slang/slang-13600`). Live STEP 3 still says "(part k/N)". #13600 has 0 comments. szihs
now owns the fix in drafts: nanoclaw **#1996** (threads on text channels via `thread_name`, returns `thread_id`) and
**#1997** (gate refuses "(part k/N)", and carries the proposed STEP 3 text in `docs/scheduled-tasks.slang-coworkers-prod.md`),
plus slang-skills#64. All three are drafts, last updated 10-14. #1672 is still a draft. **The proposed STEP 3 depends on #1996
being deployed**, so applying it before then creates no thread. Options sent to the operator: (a) leave it, (b) interim edit
that drops the prefix, (c) pause one fire. No further timer. To edit the task, run `ncl tasks update slang-pr-report-committe-83e0
--group ag-1776713258088-r8pp2t`; without `--group` it returns "task not found".


### 10-15 15:37Z: jkwak-work review comment on #13593 (cmt 6195975283), held
`github.pr_mention` webhook, but the body @-mentions nobody, the bot included. It is review feedback to szihs: *"comment"*
is too vague (GitHub, Slack, Discord, source code comment); be specific. Live body matched the payload (`updated_at` =
`created_at`). It is still the only human comment in the batch (#13591–#13602, #13585 has no reviews); #13585 is still a draft.
Where the PR's wording actually exposes the ambiguity: `docs/design/coding-conventions.md` sits in its "Comments and
Documentation" section, so there "comment" is source code. But the `AGENTS.md` line ("Comments state contracts...") and the
skill's "every touched name and comment" don't say so, and the batch also sets rules for PR descriptions, reviews and
Discord. **Held: no dispatch, no bot post.** szihs owns the issue and the PR, so the reply is theirs. These facts went to the operator only.

### 10-22 11:33Z: dashboard re-triage ask on #13602 (replay-harness eval), answered from live state
Correction to the header: the batch was not self-assigned. The timeline shows **jhelferty-nv assigned szihs** on every
issue checked (#13591, #13592, #13596, #13601, #13602). #13602 was milestoned "Q4 2026 (Fall)" by jkwak-work on 10-19.
It still has 0 comments and 0 labels, and no PR names it. Not a compiler issue: it is process and review tooling, with no
defect and no severity. It is blocked because its candidate bundle is all drafts: #13589 (REVIEW.md trim), #13585 (clarity
checklist) and slang-skills#63 (STE skill, last updated 10-15). The harness `~/slang-review-eval` is szihs's own and is
not on our mounts. Held: no dispatch, no bot post.
