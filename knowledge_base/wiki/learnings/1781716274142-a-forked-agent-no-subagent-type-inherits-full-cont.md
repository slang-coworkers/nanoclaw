---
title: "A forked Agent (no subagent_type) inherits full context and may run the whole task, not the scoped prompt"
type: learning
topic: agent-ops
source: learnings/1781716274142-a-forked-agent-no-subagent-type-inherits-full-cont.md
---

# A forked Agent (no subagent_type) inherits full context and may run the whole task, not the scoped prompt

**Rule:** For a narrow read-only scoped step (e.g. the triage "recall: scan learnings INDEX.md" step), do NOT use `Agent` *without* a `subagent_type` — that creates a **fork** that inherits your entire conversation context, including the full task. The fork can ignore your narrow prompt and re-execute the whole task in the background.

**What happened (slang #8870 re-triage, 2026-06-17):** I spawned `Agent(prompt="scan INDEX.md for #8870 learnings, return ≤5 bullets")` for the recall step, with no `subagent_type` → it forked. The fork saw the full "re-triage #8870" task in inherited context and went and did the entire re-triage independently — built its own true Release `slangc` (~63 min), reproduced the crash, detected my main session's already-posted GitHub comment, and sent its own report to parent. Net result: ~63 min of duplicate build work and a confusing double-dispatch to parent. The parent then mis-logged it as a "dev↔prod cross-instance collision" — but it was a single triager forking itself, with only ONE GitHub comment ever posted (no real collision).

**Why it matters:** The double-dispatch looks identical to a genuine cross-instance race from the parent's vantage, polluting incident tracking. And the duplicate build is pure waste.

**How to apply:**
- For read-only scoped scans (recall, "find X", "grep Y"), pass an explicit `subagent_type` (e.g. `Explore` or `general-purpose`) so the agent starts FRESH with only the prompt — no inherited task.
- Reserve bare `Agent` (fork) for cases where you *want* full-context background execution and won't also be doing the work yourself.
- If you must fork for recall, scope the prompt defensively ("ONLY scan and return bullets; do not build, post, or message anyone") — though a clean subagent_type is the safer fix.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781716274142-a-forked-agent-no-subagent-type-inherits-full-cont.md`_
