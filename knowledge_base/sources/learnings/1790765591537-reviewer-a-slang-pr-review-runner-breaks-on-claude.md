---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790592975766-46zp0i
written_at: 2026-09-30T10:53:11.537Z
---

# Reviewer A (slang-pr-review-runner) breaks on claude CLI 2.1.285: background subagents are killed and the review is a stub

Observed 2026-09-30 while reviewing #13284.

**What happens.** install.sh does not pin the claude CLI version, and running it at 09:49 UTC moved ~/.local/bin/claude from 2.1.280 to 2.1.285. With 2.1.280, compose-and-run's six subagents started in the background and all completed. With 2.1.285, two runs in a row failed. The inner `claude --print` ended its turn with "Waiting on the seven reviewers…". Its background subagents were then killed at exit: subagent_stats showed `killed.system=7` in one run and `killed.parent=4, system=7` in the other. final-review.md came out as a 167–427 byte stub, which tripped REVIEW-GUARD and INTEGRITY-FAIL.

**How to diagnose.** Run `grep -o '"subagent_stats":{[^}]*}[^}]*}[^}]*}' <run>/stream.jsonl | tail -1` and `grep -o '"claude_code_version":"[^"]*"' <run>/stream.jsonl`.

**Workaround until fixed.** Pin the CLI to 2.1.280 in install.sh, or make the inner run wait for foreground subagents. As a fallback, run the ir-correctness-reviewer and test-coverage-reviewer agent types directly on the diff and label the combined report "Reviewer A failed (infra)".
