---
type: chain
title: slang#13591 contributor standards for AI assistants (R-series)
description: szihs's umbrella #13591 + sub-issues #13592–#13602 (R1–R10, eval), filed 2026-10-13 11:07; maintainer-owned, bot not dispatched
---

# slang#13591 R-series (contributor standards for AI coding assistants)

szihs filed umbrella #13591 and sub-issues #13592–#13602 within ~20 s on 2026-10-13. Each is
self-assigned, carries its own PR (slang and slang-coworkers/nanoclaw), and needs no triage.
Each Main session routed its webhook to **no coworker and posted nothing**.

- **R5 #13595** (one-line AI disclosure): slang PR #13586 (draft, stacked on #13584), nanoclaw
  #1991 (nv-main) and #1992 (nv-slang). Done when #13586 merges and the coworkers write the line.
- **R9 #13599** (label bot items, hide by default): szihs draft PR #13588 (`.github/workflows/bot-label.yml`
  + CONTRIBUTING.md, branch `authorship/r9-bot-label`). Done when #13588 merges and new bot items carry
  `bot`. Fleet impact once merged: nv-slang-bot items get `bot`, and `no-bot`/`bot-ok` labels gate
  what the bot may pick up, so triager/fixer intake should honour them.

- **Umbrella #13591** (Main webhook session `p2bb7m`, 11:1xZ): open, 0 comments, no labels, assigned to szihs
  by jhelferty-nv at 11:07:15Z. Live body = payload. Lists R1–R10 plus "shorter reviews / gym eval"; every check
  starts in warn mode, adopted only after the replay harness shows a 40% drop in review text. Six szihs drafts back
  it: #13584–#13589 (all 08:1xZ). Routed to no coworker, nothing posted.
- **Update 10-29:** nanoclaw#1993 **merged 10-25** without the wait. Per the maintainers' 10-24 decision, the gate only skips
  `GoodFirstBug`/`HelpWanted`/`no-bot` and accepts `bot-ok`; every other issue is delivered at once. The 4-day hold
  described next was dropped.
- **R6 #13596 changes Main's own intake once its gate lands**: skip `GoodFirstBug`/`HelpWanted`/`no-bot`, and hold
  human-filed issues 4 days unless a maintainer adds `bot-ok` or it's a crash with a reproducer. The gate lives in
  slang-coworkers/nanoclaw nv-main, so it's a host change, not a routing habit. Until it merges, the
  `issue_opened → slang-triager` row in CLAUDE.md is unchanged. Whether to honour it early is the operator's call.

- **"Shorter reviews" #13601** (Main webhook session `9huank`, 11:1xZ): open, 0 comments, assigned to szihs, live body =
  payload. Backed by szihs draft PR #13589 (`authorship/shorter-automated-reviews`, REVIEW.md only, +25/−35; only
  coderabbit has commented). Done when #13589 merges after the replay harness shows a 40% drop with no true finding lost.
  Routed to no coworker, nothing posted. **Fleet impact once merged**: `slang-pr-review-runner` reads `REVIEW.md` live, so
  our local reviews pick up the new format with no skill edit. That means six-line inline comments, a verdict-only body
  on a clean PR, no Changes Overview, at most eight clarity candidates and under 4,000 characters. No fleet skill
  hardcodes "Changes Overview" (grepped `/app/skills` 10-13).

A later human comment on any of these is a live inbound. Route it by its content; don't triage
the issue itself.

- **R4 #13594** (one review workflow), 2026-10-22 dashboard "New issue to triage" re-ask, answered from live state
  with no dispatch and no post. Open with 0 comments. Assigned to szihs by jhelferty-nv (not self-assigned).
  jkwak-work milestoned it **Q4 2026 (Fall)** on 10-19. Unlike the other R-items it has **no backing PR**: no szihs PR
  touches `claude-pr-review.yml`, which at blob `0f4d3ec0` still fires on `pull_request_target`. Its gate is the
  replay-harness eval in #13602 (open, 0 comments). The fleet part is "slang-reviewer reviews new PRs". Turning that
  on is an operator decision, made once parity is shown.
- **R4 #13594, 2026-11-02 12:12Z: szihs comment 6576832254**, the issue's first comment. It mentions no one. It reframes R4 around data: show whether the Claude
  PR review and CodeRabbit find real issues and whether they overlap. If they overlap, disable one. If both add value,
  keep both, but comments must follow guidelines. **Held: no dispatch, no bot post.** Operator offered fleet help to
  produce the data. The existing `review-rounds.json` can't answer it, because it filters automation out; it only
  counts volume (since 04-10: 12,683 `github-actions` comments, which cover all workflows, and 6,789 `coderabbitai`).
  One-shot re-check task `rechase-13594-r4-data-as-0202` is set for 11-06 12:00Z.
- **R4 #13594, 2026-11-03 15:32Z: szihs comment 6607975500** posted the data, which makes Main's 11-02 offer moot. The re-check task
  `rechase-13594-r4-data-as-0202` is cancelled. The numbers are szihs's, measured on the 212 PRs behind the review eval tasks
  (2,561 threads, Jul–Oct). Human threads: 953, 76% acted on. Claude Action: 1,384 threads on 68 PRs, 20.4 per PR, 50% acted on,
  30% ignored, raised 25% of human threads. CodeRabbit: 215 threads on 66 PRs, 3.3 per PR, 71% acted on, raised 4%. The bots
  share almost no findings: 6 human threads were raised by both. szihs's conclusion is that the Action's problem is volume,
  not accuracy, which the #13589 short format addresses. **Our slang-reviewer gym baseline** (current prompts, 43/60
  trials): recall 0.57, precision 0.14, 16 findings and 7,700 chars per review, so it is as noisy as the Action. A short-format
  run comes next. Source: `adapters/review_history.py` in slang-coworkers/slang-eval-tasks, job `eval-r4-history2`.
  The comment mentions no one, so this is still held: no dispatch, no post.
