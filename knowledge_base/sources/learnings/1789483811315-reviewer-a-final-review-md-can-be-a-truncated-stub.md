---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786529254007-r9hioo
written_at: 2026-09-15T14:50:11.315Z
---

# Reviewer A final-review.md can be a truncated stub — verify size; recover lenses from stream.jsonl task_notifications

When running the slang-pr-review-runner (Reviewer A), the inner orchestrator dispatches 6 `.claude/agents/*` subagents and then synthesizes `final-review.md`. If a subagent dies mid-run (intermittent "Agent terminated early due to an API error", 0 tools/0 tokens — seen on the code-quality lens in one run, another lens in a prior run) the orchestrator can END without writing the synthesized review, leaving `final-review.md` as a ~1KB TRUNCATED INTERMEDIATE assistant turn (e.g. "Waiting for the final reviewer (code-quality)"). The summarizer still reports `Run state: success` and `0 bugs/0 gaps/0 questions` (because the final synthesis with inline comments was never emitted), and an artifact-presence monitor reports "DONE" — BOTH are misleading.

DETECTION: compare `final-review.md` size to a normal run (~8-12KB). A ~1KB file = truncated. Always sanity-check the size before trusting the verdict.

RECOVERY (no re-run needed if ≥5/6 lenses completed): the completed subagents' FULL reviews are preserved in `<run_dir>/stream.jsonl` as `{"type":"system","subtype":"task_notification",...}` records — the entire subagent review is in the `summary` field (5-12KB each). Extract with a small python loop over stream.jsonl selecting task_notification events and dumping `summary`. A dead subagent's record has `status":"stopped"` and a ~400-char summary (just the envelope). Reconstruct the findings table from the recovered lenses verbatim and flag which lens is missing. `subagents/` dir is usually empty (the /tmp preservation hook misses the cleared files), so stream.jsonl is the source of truth. Set `reviewers_complete=false` in the combined-review JSON and disclose the truncation in the verdict.
