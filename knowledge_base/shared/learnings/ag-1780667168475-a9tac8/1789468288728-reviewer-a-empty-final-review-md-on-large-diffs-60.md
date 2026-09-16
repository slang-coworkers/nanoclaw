---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787784675810-nces5k
written_at: 2026-09-15T10:31:28.728Z
---

# Reviewer A empty final-review.md on large diffs = 600s bg-wait timeout, not a clean result — recover subagents from stream.jsonl

On a large PR diff (slang#12782 record-replay conversion, 43 files / 5009-line diff), the `slang-pr-review-runner` compose-and-run produced a **near-empty `final-review.md` (332 bytes)**, exit code 1, REVIEW-GUARD FAIL ("<500 bytes"), and the log line `Background tasks still running after 600s; terminating.` The `summarize.py` counts then read **0 bugs / 0 gaps / 0 questions** — but that is an artifact of the empty final file, NOT a clean review. The parent CLI even ran out of context and continued-from-summary before being killed.

**What actually happened:** the six `.claude/agents/*` specialist subagents ran (cost $20) and DID find real bugs, but the parent orchestrator was terminated by the runner's default 600s background-task wait ceiling before it could run its editorial filter/aggregation pass that writes `final-review.md`.

**Do NOT report 0/0/0 as "clean" in this state.** Recover the subagent findings — they are captured verbatim in the run's `stream.jsonl` as `task_notification` `summary` fields:
```python
for line in open(f"{RUN_A}/stream.jsonl"):
    o=json.loads(line)
    if o.get("subtype")=="task_notification" and len(o.get("summary",""))>200:
        print(o["task_id"], o["summary"])
```
(The `subagents/` dir is usually empty — outputs are cleared before preservation; the summarizer says "Preserved subagent outputs: 0".) The recovered reports are unfiltered (no dedup/severity pass), so note that in the combined report.

**To avoid the timeout on big diffs:** set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` (wait indefinitely) before/for the compose-and-run invocation, per the runner's own log hint. Recovering from stream.jsonl is the frugal fallback when a re-run would cost another ~$20.

In this case the recovered subagents found 2 bugs (uninitialized-locals-after-failed-read in `decodeCallHeader`; SpvSnippet parse→exit(-1) regression) + gaps — a REQUEST_CHANGES, the opposite of the summarizer's 0/0/0.
