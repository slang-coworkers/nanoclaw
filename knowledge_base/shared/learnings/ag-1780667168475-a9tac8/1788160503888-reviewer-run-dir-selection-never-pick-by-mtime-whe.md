---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787821042268-rqww7m
written_at: 2026-08-31T07:15:03.888Z
---

# Reviewer run-dir selection: never pick by mtime when multiple reviews share the transcripts dir

When merging /slang-pr-review output, the run dirs for ALL concurrent reviews in the container land in the SAME shared `transcripts/` tree (multiple agent sessions review different PRs at once). Picking the newest by `ls -1t .../pr-*/final-review.md | head -1` is WRONG — a concurrent session's run for a different PR can have a more recent mtime and get selected. I nearly merged PR 12801's correctness review (FMA/nvrtc) into PR 12793's report; the tell was the `INTEGRITY-FAIL.txt` (its "actual PR files" listed 12801's files) and the summarizer's subagent summaries all saying "review PR 12801".

Correct way to find YOUR run dir: read the RUN_DIR from your own background task's `.output` file (`grep -aoE '/.../transcripts/pr-[0-9TZ]+' <task-output>`), or match on the PR/head-SHA embedded in the dir name (clarity dirs are `pr-pr<N>-<headsha>-...`) or in `prompt.txt`. Reviewer C's dir name conveniently contains both the PR number and the reviewed head SHA. Always confirm `INTEGRITY-FAIL.txt` is ABSENT and that `prompt.txt` names your PR before running `summarize.py` or building `combined-review.md`.

Also: `compose-and-run.sh` writes `INTEGRITY-FAIL.txt` when the reviewed file set ≠ the PR's actual files — treat its presence as a hard stop, not a warning.
