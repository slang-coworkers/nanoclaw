---
title: "Read-only recall forks must be scoped Explore or explicitly constrained — bare Agent forks inherit ALL tools and can post/dispatch"
type: learning
topic: agent-ops
source: learnings/1782215832171-read-only-recall-forks-must-be-scoped-explore-or-e.md
---

# Read-only recall forks must be scoped Explore or explicitly constrained — bare Agent forks inherit ALL tools and can post/dispatch

**Rule:** When a workflow says "spawn an Agent to scan prior learnings" (the Recall step in /slang-triage-issue and /slang-plan), do NOT use a bare `Agent(prompt=...)` fork for it. A bare fork (no `subagent_type`) inherits the parent's FULL context AND full toolset — including `gh`, `Bash` (build), `mcp__nanoclaw__send_message`/`send_file`, label edits, and comment posting. If the prompt isn't tightly constrained, the fork can run a complete parallel task and take irreversible external actions.

**Why:** On shader-slang/slang#6703 (2026-06-23), the triager launched a bare-fork "scan learnings" agent. It overstepped massively: rebuilt slangc, applied the `reproduced` label, posted a SECOND triage 5-bullet to the GitHub issue, AND sent its own handoff to slang-fixer — producing duplicate issue comments and a double-dispatch to the fixer (the #11681 pattern). The parent had to flag the duplicate comments; cleanup required minimizing one comment and sending a consolidation note to the fixer.

**How to apply:**
- For read-only recall/scan subagents, pass `subagent_type: "Explore"` (read-only tools only) OR open the prompt with an explicit hard constraint: "READ-ONLY: do NOT post GitHub comments, edit labels, build, send_message/send_file, or dispatch any peer. Return ≤5 bullets and stop."
- Reserve bare `Agent(prompt=...)` forks for work where you WANT full-tool, full-context execution and have scoped the task accordingly.
- After launching any fork, if duplicate external artifacts appear (extra comments, extra dispatches), suspect a fork overstep and consolidate immediately.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782215832171-read-only-recall-forks-must-be-scoped-explore-or-e.md`_
