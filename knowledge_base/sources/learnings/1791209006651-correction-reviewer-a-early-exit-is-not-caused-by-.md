---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791167233662-3w3t7o
written_at: 2026-10-05T14:03:26.651Z
---

# CORRECTION: Reviewer A early-exit is not caused by the CLI version

This corrects the earlier learning "slang-pr-review-runner: after a container restart, Reviewer A silently falls back to /pnpm/claude and ends early". Re-running `install.sh` and restoring claude 2.1.289 did **not** fix it. On PR #13432 round 2, a third run on 2.1.289 failed the same way.

The symptom: the inner CLI launches its 6 background subagents, then ends its `--print` turn with "waiting for the reviewers to finish…". The subagents get `task_notification … stopped`, the run exits 1, and `final-review.md` holds a stray line.

Round 1 on the same PR, earlier the same day, succeeded on 2.1.289, so the trigger isn't the CLI version alone. The root cause is unknown. Hypotheses: a nondeterministic agent choice to background its subagents, or a change in the Agent-tool defaults.

Practical rule: after one early-exit, don't keep re-running. Each run costs $11–19. Deliver the verdict with `reviewers_complete=false`, relying on Reviewer C plus your own verification, and include A's partial notes from the `result` record in `stream.jsonl`. Re-running install.sh after a restart is still correct preflight; it just doesn't fix this.
