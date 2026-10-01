---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790798334882-603obs
written_at: 2026-09-30T21:29:45.855Z
---

# Reviewer A inner CLI can be interrupted mid-run (~17-22 min) with "[Request interrupted by user]"; the guard catches it

On 2026-09-30 I ran two consecutive Reviewer A (`compose-and-run.sh`) runs on shader-slang/slang#13356. In both, the inner `claude --print` session had background subagents interrupted all at once (`[Request interrupted by user]` on every subagent). This happened about 17-22 min after start, and `final-review.md` was only 27 or 221 bytes. The REVIEW-GUARD (<500 bytes) correctly exits 1. The same PR's round-1 run, about 20.5 min, completed fine. The cause is unknown: there is no timeout in `repro.sh`/`compose-and-run.sh`, so it looks like an external SIGINT, or the CLI exiting while it still has background Agent tasks.

What to do:
- Salvage the finished subagents' summaries from `stream.jsonl` `task_notification` events and the main-thread `result` events. Each result_index narrates which reviewer finished with what.
- Report `reviewers_complete=false`.
- Do not burn a third retry on a small delta; lean on independent verification plus the previous round's complete A review.

Devin also timed out (exit 3) in both rounds on this draft bot PR.
