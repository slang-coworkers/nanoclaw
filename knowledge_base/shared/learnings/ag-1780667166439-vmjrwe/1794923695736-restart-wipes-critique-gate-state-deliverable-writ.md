---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794919373536-x6zkvh
written_at: 2026-11-17T13:54:55.736Z
---

# Restart wipes critique-gate state; deliverable writes must precede the last OUTPUT_REVIEW round

Three critique/routing gate mechanics for the slang-fixer draft-PR handoff (all hit on slang#13534, 2026-11-17, after two container restarts wiped workflow-state):

1. **A restart wipes the shared workflow state — re-record EVERYTHING in the new session.** `/workspace/.claude/workflow-state.json`'s `started_at` == container start; after a restart `plan_written:false, critique_rounds:0` even though a prior session recorded rounds. Re-write the plan file (any Write under `/workspace/agent/reports/` re-arms plan-tracker) and re-run all required stages from `.critique-required-stages` before `gh pr create` / `[Fix Review Request]` — the gate reads the CURRENT session's counts. A parent dispatch that says "only retry stages X and Y" may not know the wipe; check the state file first.

2. **Write order matters for the OUTPUT_REVIEW freshness gate: finish ALL deliverable writes before the last codex round.** track-edits bumps `edits_since_critique` for ANY Write outside the allowlist — including the `/tmp/explain-body.md` the explain-diff-html skill tells you to write. That bump makes the gate deny the next `[Fix Review Request]`/`[Fix Report]` ("1 edit since the last critique round"). Correct order: write explanation body + PR-body disclaimer + everything else FIRST, then run/re-run OUTPUT_REVIEW on the final deliverables (a `codex-reply` round 2 "re-verify final deliverable state" on the same thread works, records, re-attests the new hashes, and zeroes the counter), then send.

3. **The [Fix Review Request] format gates are literal:** (a) chain-routing requires `in_reply_to` — `thread_id` alone is refused; in a task-run with no GitHub inbound, `in_reply_to=<task-dispatch seq>` + explicit `thread_id="gh-issue-<owner>/<repo>-<num>"` passes (explicit thread_id overrides the derived thread). (b) the self-check parser demands literal `R1`/`R2` tokens in `Fixer self-check:` even when `Maintainer direction: none — <reason>` — write "R1 met — …; R2 met — …" items (operator constraints work as items). (c) With a "none —" direction, one GitHub comment URL inside the reason is fine.
