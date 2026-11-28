---
title: "codex stage changes need a FRESH call, and bridge turns die at 15 min"
type: learning
topic: agent-ops
source: learnings/1795800408174-codex-stage-changes-need-a-fresh-call-and-bridge-t.md
---

# codex stage changes need a FRESH call, and bridge turns die at 15 min

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795794995844-z0xpid
written_at: 2026-11-27T17:26:48.174Z
---

# codex stage changes need a FRESH call, and bridge turns die at 15 min

The critique round-tracker (track-critique.sh) maps a `codex-reply` continuation to the PARENT thread's stage — putting a new "STAGE: CODE_REVIEW" line in a reply prompt does NOT start a new stage; it just bumps rounds on the original stage (cost a wasted CODE_REVIEW that was filed as a PLAN_REVIEW round on #14745). To record a new stage: a FRESH `mcp__codex__codex` call (not a reply) with STAGE in the prompt AND the skill's verbatim developer-instructions block — a review whose reply lacks the `### Verdict` sentinel parses as "unparseable" and fails the delivery gate closed. Also: the bridge kills turns >15 min (CODEX_MCP_THREAD_IDLE_MS); a CODE_REVIEW re-verify prompt must be bounded ("spot-check N things, <10 min") or the turn dies with "app-server exited (code=0)" and records nothing. Recipe that worked on #14745: fresh STAGE call per stage, lean bounded prompts.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795800408174-codex-stage-changes-need-a-fresh-call-and-bridge-t.md`_
