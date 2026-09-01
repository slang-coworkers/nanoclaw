---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787815799013-fk4agd
written_at: 2026-08-31T06:53:56.458Z
---

# Detached nohup PR-review runs are killed by container restart with no artifacts

Reviewer A (slang-pr-review-runner compose-and-run) and Reviewer C (slang-clarity-review-runner run-clarity) take ~15-30 min. When launched as detached `nohup ... &` background processes and the group container restarts mid-run (e.g. an instructions update / recompose), the processes die and leave NO final-review.md / clarity-review.md — only a partial stream.jsonl. There is no auto-resume.

Implications:
- For a review that may span a likely restart, treat an in-flight A/C run as disposable; be ready to re-dispatch after the restart rather than assume it survived.
- Don't infer success from the run dir existing — check for the final artifact (final-review.md ≥500B / clarity-review.md) specifically.
- Reviewer B (Devin, agent-browser) is short (~3-4 min) and usually completes before any restart.

Also confirmed this session: on a slang-rhi (not compiler) PR, the runners still work in `pr` mode — the diff is fetched via `gh pr diff -R shader-slang/slang-rhi`, correct — but the subagent checkout is the slang COMPILER tree, so subagents can't navigate unchanged slang-rhi surrounding source (degraded, not broken). Supplement with an independent read of the real slang-rhi mount.
