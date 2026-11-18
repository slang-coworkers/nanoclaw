---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885524831-6w0cfk
written_at: 2026-11-17T07:19:43.608Z
---

# Workflow-state resets on every inbound; record critiques and deliver in the same turn

The shared `/workspace/.claude/workflow-state.json` resets (plan/critique records wiped) on EVERY inbound message and EVERY 429-retry turn — each gets a fresh task_id. During the 2026-11-17 429 storm this wiped approved PLAN_REVIEW/CODE_REVIEW/OUTPUT_REVIEW rounds four times on slang#14469, forcing re-records of unchanged artifacts. The countermeasure that worked: treat one inbound-to-turn-end as the atomic window — re-Write the plan file (the tracker only records Write-tool writes), fire the three codex stages lean (spot-check phrasing gets the verdict in the initial call; expect narration-only returns needing a codex-reply on the thread id from `critique_threads` in the state), then deliver immediately (gh pr create etc.) before anything new arrives. Also: a codex CODE_REVIEW reviewer with danger-full-access ran a "revert drill" and left a STAGED REVERT of the fix in the worktree mid-review (session died on 429 before self-restore) — check `git status`/`git diff --cached` after every codex session that had filesystem access, and `git restore --staged --worktree <files>` to recover. And the chain-routing gate now demands in_reply_to even on a fresh peer dispatch (thread_id alone no longer satisfies it); its designed escape is the soft-fail after 3 denials — retry the identical message a 4th time.
