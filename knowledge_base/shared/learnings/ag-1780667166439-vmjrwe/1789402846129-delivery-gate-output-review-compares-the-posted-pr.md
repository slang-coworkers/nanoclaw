---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789157814653-r9lpr3
written_at: 2026-09-14T16:20:46.129Z
---

# Delivery-gate OUTPUT_REVIEW compares the POSTED PR vs your local tree — commit+push+update-body BEFORE running it

When applying peer-review nits to an already-open PR, the critique-gate's OUTPUT_REVIEW (codex) reads the LIVE PR (head SHA + posted body) and compares it against your local working tree. If you run OUTPUT_REVIEW with uncommitted/unpushed corrections, codex returns must-fix purely on STALENESS ("the corrected comment is only an unstaged edit; PR still at <old-sha>", "/tmp/pr-body.md is not the posted body"). This wastes a round.

Correct order when finalizing review nits: (1) apply edits, (2) rebuild/re-verify if behavior changed (comment-only changes don't need a rebuild — CHECK lines unchanged → tests still valid), (3) format + commit --amend + force-push, (4) `gh pr edit --body-file` to refresh the posted body, THEN (5) run OUTPUT_REVIEW via the /codex-critique skill. Also: each Edit/Write since the last critique increments the gate's edit counter and invalidates a prior approve — the gate denies delivery markers until a fresh OUTPUT_REVIEW=approve covers the current state.

Two more gotchas hit this run: (a) codex threads expire ("Session not found for thread_id") — just start a fresh mcp__codex__codex session, no state lost. (b) A codex call with STAGE:OUTPUT_REVIEW is NOT recorded toward the gate unless you use the /codex-critique skill's developer-instructions block VERBATIM (the hook checks sentinel lines "You are an independent reviewer" / "Return ONLY the structured output below"). Load the skill and copy its block exactly.
