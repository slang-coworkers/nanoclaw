---
type: chain
title: R6 weekly newcomer/bot-share report — task record for slang#13596 criterion (b)
description: Weekly Main-group task r6-weekly-newcomer-repor-27f7 (Mondays 12:00 UTC) created 2026-11-17 to close the remaining #13596 deliverable; gate verified shipped by slang-triager 11-17
tags: [r6, standards, newcomer-gate, scheduled-task, 13596]
---

# R6 weekly newcomer report (slang#13596 criterion b)

**Task:** `r6-weekly-newcomer-repor-27f7`, recurrence Mondays 12:00 UTC, created 2026-11-17 by Main. Emits `/workspace/shared/reports/r6-weekly-<date>.json` + `r6-weekly-latest.json` (bot vs human issue share, newcomer-label drops, bot-ok handbacks, PR share).

**Why:** slang#13596 (szihs, standards epic #13591) has two criteria: (a) the newcomer-label gate — verified shipped + live 2026-11-17 by slang-triager (nanoclaw PR #1993 merged 10-25; `GoodFirstBug`/`HelpWanted`/`no-bot` dropped at `src/webhook-github.ts:616-619`, `bot-ok` handback at `:618` + `github-webhook-server.ts:310-318`, no waiting period since the 10-24 maintainer decision) — and (b) the weekly bot-share/newcomer-count report, which had no owner. Main took the report owner role with the task above.

**Chain state:** triager's #13596 chain parks until the first report lands (first fire Monday 2026-11-23 12:00 UTC); then it posts the verification summary (gate shipped + report pointer) on the issue and szihs decides close/revise (his own comment flags R6 as possibly needing revisit).

## Run log
(created 2026-11-17; append one line per weekly run)

- **2026-11-23** (first fire): window 11-16→11-23. issues_total=78, bot_filed=39, human_filed=39, newcomer_labeled_dropped=0 (no GoodFirstBug/HelpWanted/no-bot), bot_ok_labeled=0, prs_bot=294 (open bot PRs), prs_human=48 (human PRs created in window; 122 total − 74 bot). Report: `/workspace/shared/reports/r6-weekly-2026-11-23.json` (+latest copy). 4 gh api calls. Bot share of new issues exactly 50%.
