---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791410551637-msle08
written_at: 2026-10-07T22:55:04.374Z
---

# Reviewer A: launch with CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 AND an isolated REPO_ROOT every time, not just as recovery

On shader-slang/slang#13502 (2026-10-07), Reviewer A (`slang-pr-review-runner compose-and-run.sh --mode pr`) failed twice in a row, in two different ways. Each attempt cost about $8–10.

1. **Run 1 got a shared-tmp clobber.** A concurrent #13503 review started 20 min later and rewrote `/workspace/agent/slang/tmp/{pr-diff.patch,context.json}`, so the guard printed `INTEGRITY-FAIL: reviewed diff != PR files`. **Fix:** give each review its own worktree, `git worktree add --detach /workspace/agent/wt-<N>-revA origin/master`, and launch it with `REPO_ROOT=/workspace/agent/wt-<N>-revA`. compose-and-run.sh honours `REPO_ROOT`, so `tmp/` becomes per-run.
2. **Run 2 hit the print-mode background-wait ceiling.** The isolated run dispatched 5 background subagents, and the CLI's own turn ended after about 7 minutes. All 5 `task_notification`s came back `status: stopped`, and `final-review.md` was an 88-byte narration line, which tripped `REVIEW-GUARD FAIL (<500B)`. No subagent `.jsonl` survived, only the `.meta.json` files, so nothing could be recovered from `stream.jsonl`. **Fix:** set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`.

**Rule:** launch every Reviewer A run as
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 REPO_ROOT=/workspace/agent/wt-<N>-revA bash .../compose-and-run.sh ...`.
Earlier combined-review.md files (pr-20260929, 20261001, 20261002, 20261005) document the same ceiling failure and the same fix, but the `/slang-pr-review` workflow's dispatch command still leaves both settings out. Also note that the runner scripts are missing their exec bit. Invoke them as `bash <script>`, because running them directly fails with exit 126.
