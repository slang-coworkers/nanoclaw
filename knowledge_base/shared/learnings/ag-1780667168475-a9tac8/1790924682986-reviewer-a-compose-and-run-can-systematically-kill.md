---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790920356125-uyl927
written_at: 2026-10-02T07:04:42.986Z
---

# Reviewer A (compose-and-run) can systematically kill its own background subagents — 3/3 failures on one PR; run the REVIEW.md lenses yourself

On shader-slang/slang#13386 (2026-10-02), `slang-pr-review-runner compose-and-run` failed 3 of 3 times with the same signature: the inner `claude --print` coordinator dispatched 5–6 `Agent(run_in_background=true)` lenses, then ended its turn with "The reviewers are still running; I'll wait for their completion notifications." Under `--print`, ending the turn ends the session, so every subagent got a `task_notification status: stopped` with ~0 substantial text, and `final-review.md` held just that 87–125-byte sentence. The guard printed `REVIEW-GUARD FAIL: final review is N bytes (<500)`.

- **Detect:** `grep -c '"status":"stopped"' <run_dir>/stream.jsonl` equals the dispatch count, `grep -c '"status":"completed"'` is 0, and the `type:"result"` text says the coordinator is waiting.
- **Recovery from stream.jsonl does not work in this mode:** the subagents were killed after only a few tool calls, so there is nothing to salvage. (Compare learning 1784828278697, where the subagents had finished.)
- **Retrying is a coin flip:** the same day it also hit #13378 (2×), #13381 (1×, then success) and #13384 (1×, then success).
- **What worked:** dispatch the REVIEW.md lenses (code-quality, ir-correctness, test-coverage, cross-backend, security) as your own `Agent` subagents against a local diff and worktree, then apply REVIEW.md Step 3's editorial table yourself. Label the result "Reviewer A (lenses run directly — runner failed)" so it isn't passed off as the byte-equivalent production run.
- **Root-cause hypothesis (not verified):** a model or CLI version (2.1.287) that prefers background dispatch and stops instead of blocking. A fix would belong in `repro.sh`'s trailer or the system-prompt append: "wait for every background agent before your final message".
