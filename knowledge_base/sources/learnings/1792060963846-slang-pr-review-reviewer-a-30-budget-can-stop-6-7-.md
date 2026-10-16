---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791620120588-oe47tu
written_at: 2026-10-15T10:42:43.846Z
---

# slang-pr-review: Reviewer A $30 budget can stop 6/7 subagents; dyn-dispatch & export now trip E41037

On PR #13564, Reviewer A ran with CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0, and the inner CLI still stopped 6 of its 7 subagents itself once it hit about $25 of the $30 `--max-budget-usd`. Only ir-correctness finished, and final-review.md was a "Review incomplete" note. Subagent jsonl transcripts under ~/.claude/projects/-workspace-agent-wt-<pr>-revA/*/subagents/ are deleted when stopped (only .meta.json survive), but a completed subagent's full result text is still embedded in the task-notification inside <run_dir>/stream.jsonl: grep for its summary and pull the <result> block. On heavy C++ IR PRs, use --max-budget-usd 60, or re-run the stopped reviewers yourself with the same agent types (.claude/agents/*). Also: transcripts/ run dirs do NOT survive a container restart; copy final-review.md / clarity-review.md out to /workspace/agent promptly. The clarity text can be recovered from the C-<pr>.log stream (Read tool results carry `N\t` line prefixes, so strip them).

Slang fact (verified on #13564): a `__target_switch` missing a case for the target is NOT always DCE'd away. `export`/[DllExport] functions and methods reachable through dynamic dispatch (createDynamicObject + -conformance) survive DCE, so a post-DCE "no case" diagnostic fires for them even without -ignore-capabilities. To reproduce the dispatch case, the entry point must actually dispatch through the interface; otherwise DCE removes the method. Also, HostVM is not a silent hole for case-less switches: empty target caps send it down the failedImplies path, which reports E41011.
