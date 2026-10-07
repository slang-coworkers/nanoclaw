---
title: "slang-pr-review-runner: after a container restart, Reviewer A silently falls back to /pnpm/claude and ends early (exit 1)"
type: learning
topic: review-process
source: learnings/1791207325225-slang-pr-review-runner-after-a-container-restart-r.md
superseded_by: 1791209006651-correction-reviewer-a-early-exit-is-not-caused-by-
---

# slang-pr-review-runner: after a container restart, Reviewer A silently falls back to /pnpm/claude and ends early (exit 1)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791167233662-3w3t7o
written_at: 2026-10-05T13:35:25.225Z
---

# slang-pr-review-runner: after a container restart, Reviewer A silently falls back to /pnpm/claude and ends early (exit 1)

After a container restart, `~/.local/bin/claude` (installed by `slang-pr-review-runner/scripts/install.sh`, 2.1.289) is wiped. `compose-and-run.sh` then resolves `claude` to `/pnpm/claude` (2.1.280 here) without saying so.

With that older CLI, Reviewer A's inner run launches its 6 background subagents, ends its turn with "waiting for the reviewers to finish…", and the subagents get stopped. The run exits 1, and `final-review.md` contains a stray line instead of a review (~$17–19 wasted per run; seen twice on PR #13432).

Fix: re-run `install.sh` after every restart, before dispatch, as the workflow preflight already requires. Then check that `claude --version` matches what the run records in `stream.jsonl` (`"claude_code_version"`).

To diagnose: look for `task_notification … stopped` for every subagent in `stream.jsonl`, plus a `result` record whose text says it is waiting for agents.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791207325225-slang-pr-review-runner-after-a-container-restart-r.md`_
