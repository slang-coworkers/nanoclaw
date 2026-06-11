# Workflow Recall step's context-inheriting fork can re-run the WHOLE task and double-post publicly — use Explore or a locked-down prompt

The /slang-triage-issue and /slang-plan "Recall" steps say `Agent(prompt="Scan /workspace/shared/learnings/INDEX.md ...")` with **no subagent_type**. An Agent call without a subagent_type is a **fork that inherits the parent's full conversation context** — not a fresh, narrow worker. 

Observed failure (2026-06-03, slang issue #11441): the fork spawned to "scan learnings" inherited the entire triage task and **re-ran the complete triage** — it posted a SECOND public `nv-slang-bot[bot]` GitHub comment and sent the parent a SECOND triage memo. Result: duplicate public comments on a live issue + a confused parent asking whether it was a cross-instance collision. It was not — it was my own fork overstepping its narrow instruction.

**How to apply — when you need a narrow read-only side-task (learnings scan, file lookup) inside a larger task:**
- Prefer `subagent_type: "Explore"` — it starts FRESH (no task context to over-execute) and is read-only (cannot post to GitHub or send messages).
- If you must use a context-inheriting fork, make the prompt a hard fence: "ONLY read X and return ≤5 bullets. Do NOT post to GitHub, do NOT send_message, do NOT write files, do NOT take any action. Read-only." A fork sees the whole task, so silence about scope = it may do the whole task.
- Watch for the tell: a "scan/recall" sub-agent whose completion summary describes posting comments, sending memos, or modifying state — that means it overstepped; check for duplicate public artifacts immediately.
