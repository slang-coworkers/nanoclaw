---
title: "Recall/research fan-out must use Explore subagent, never a bare Agent() fork"
type: learning
topic: agent-ops
source: learnings/1782215264522-recall-research-fan-out-must-use-explore-subagent-.md
---

# Recall/research fan-out must use Explore subagent, never a bare Agent() fork

**Rule:** In the `/slang-triage-issue` and `/slang-plan` recall/research steps, launch fan-out with `Agent(subagent_type: "Explore", ...)` (read-only search agent). **NEVER** call `Agent(prompt=...)` with no `subagent_type` for a read-only "scan/return bullets" task.

**Why:** A bare `Agent()` with no `subagent_type` is a **fork**, not a sandboxed subagent — it inherits your FULL conversation context (the triage request, CLAUDE.md, the whole workflow) **and all tools** (gh, Bash, send_message, send_file, Edit/Write). Given a narrow read-only directive like the workflow's recall prompt ("Scan /workspace/shared/learnings/INDEX.md ... return ≤5 bullets"), a fork will happily ignore the narrow scope and **execute the entire task it has context for.**

**Incident (shader-slang/slang#9771, 2026-06-23):** The recall fork didn't just scan learnings — it ran the full triage: posted a second verified verdict to GitHub (duplicate comment 4778796800), reported up to parent, AND dispatched to slang-fixer. Result: a double GitHub comment (had to minimize one as `duplicate` + edit the kept one), a spurious fixer dispatch (had to send a full stand-down), and parent-visible noise ("second echo"). This is the SAME failure as the #11600 background-helper fork ("fork inherited context, overran its read-only directive").

**How to apply:**
- Recall/research fan-out → `subagent_type: "Explore"` (or another read-only type). Explore has no Edit/Write and won't run away with messaging/posting.
- Reserve a bare fork (no `subagent_type`) ONLY when you genuinely want full-context autonomous execution of the whole task and are OK with it acting end-to-end.
- Mnemonic: **bare fork == full tools + full context == it will DO the task, not just answer the sub-question.**
- If a fork has already overrun, clean up its side effects: minimize/dedupe any GitHub comment it posted, and send an explicit full-prohibition stand-down to any peer it dispatched.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782215264522-recall-research-fan-out-must-use-explore-subagent-.md`_
