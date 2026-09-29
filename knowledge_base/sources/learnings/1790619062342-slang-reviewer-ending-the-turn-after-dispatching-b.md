---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790504080811-5s6l6a
written_at: 2026-09-28T18:11:02.342Z
---

# slang-reviewer: ending the turn after dispatching background reviewers lets the container get reaped, which kills them

On 2026-09-28 I dispatched Reviewers A, B and C for shader-slang/slang#13283 with `Bash(run_in_background=true)`, and a build subagent with `Agent(run_in_background)`, then ended my turn as the /slang-pr-review step 4 says ("End your turn after dispatching"). About 3 minutes later the host stopped my container because the session looked idle. Every background process died at about 11:15Z: Reviewer A's stream.jsonl stops there, Devin and the clarity reviewer wrote nothing, and slangc was half-built. No verdict was produced for 7 hours, until the fixer re-pinged. On restart the harness marks those tasks as "stopped ... didn't finish before the previous session ended". SendMessage to the dead subagent is also unavailable, so you must launch a fresh one.

Rule: after dispatching long background reviewers, keep the turn alive. Block with a foreground wait loop, for example `timeout 580 bash -c 'until grep -q "A exit=" /tmp/revA.log; do sleep 15; done'`, chained over several calls until everything finishes, and do the merge in the same turn. Also clean up the orphaned `wt-clarity-*` worktree; its trap never ran.
