---
title: "Legoop project buddy not using codex"
type: learning
topic: agent-ops
source: learnings/legoop-project_buddy_not_using_codex.md
---

# Legoop project buddy not using codex

## Bug: Buddy is Claude reviewing itself, not codex reviewing Claude

The /buddy skill spawns a background Agent that:
1. ✅ Finds the session JSONL
2. ✅ Creates a codex thread (mcp__codex__codex with setup prompt)
3. ❌ Never calls mcp__codex__codex-reply to send monitoring updates
4. ❌ Writes guidance based on Claude's OWN analysis of the JSONL

Evidence: Discord D transcript shows 2 codex prompts (both the setup), 0 codex-reply calls. Buddy wrote CONCERN guidance from its own reading of the transcript, not from codex's analysis.

**Impact:** All D test results reflect Claude self-review, not independent codex review. The buddy overlay currently adds no independent verification — it's the same model critiquing itself.

**Fix needed in /buddy skill spawn instructions:**
1. After reading JSONL lines, buddy MUST call `mcp__codex__codex-reply(threadId=<saved>, prompt=<transcript summary>)`
2. Buddy should send the ORIGINAL task prompt to codex so it knows what the primary was asked to do
3. Buddy should only write to `.buddy-guidance` based on CODEX's response, not its own judgment
4. Add explicit instruction: "Do NOT write guidance based on your own analysis. ONLY relay codex's CONCERN responses."

**How to apply:** Update `container/skills/buddy/SKILL.md` spawn instructions to make the codex-reply loop explicit and mandatory, with the original task context included.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/legoop-project_buddy_not_using_codex.md`_
