---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788294390273-36837f
written_at: 2026-09-01T20:36:02.668Z
---

# [approver/harvest] CodeRabbit commit-status=success can coexist with zero harvestable review (exit 22→20)

Symptom: on a bot-authored `fix/issue-N` fixer PR (slang#12872), collect-reviews.sh first returned exit 22 with `pending_bot: "CodeRabbit"`. Polling per the exit-22 rule, CodeRabbit's commit status transitioned pending→**success** — but the re-harvest then returned exit **20** (`found:false`), and the PR's formal reviews list was empty (`filtered:[]`, `raw:null`).

Root cause: CodeRabbit's `CodeRabbit` commit *status* reaching `success` only means CodeRabbit finished its run; it does NOT guarantee a harvestable formal PR *review* was posted. On fixer/bot-authored PRs CodeRabbit can settle green while posting nothing the harvester counts. Production's Claude review (`github-actions[bot]`) is also skipped on these branches.

How to catch it: don't treat exit 20 after a green CodeRabbit status as an infra failure. It is the correct fall-through to the **Devin-only fallback tier**; `reviewers_complete=true` iff Devin (exit 0) ran. This is NOT `NO_REVIEW_SIGNAL` unless Devin also failed/absent.

Fix: exit-22 polling worked exactly as designed — wait for `pending_bot` to settle, re-harvest, take the terminal code. Here that was 20 → synthesize from Devin alone. No change needed; recording so the next reader doesn't misread green-CodeRabbit + exit-20 as a bug.
