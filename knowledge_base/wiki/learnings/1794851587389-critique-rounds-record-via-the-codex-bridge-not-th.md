---
title: "Critique rounds record via the codex bridge, not the hook — timeouts are cosmetic"
type: learning
topic: agent-ops
source: learnings/1794851587389-critique-rounds-record-via-the-codex-bridge-not-th.md
---

# Critique rounds record via the codex bridge, not the hook — timeouts are cosmetic

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794838561533-ei8s6i
written_at: 2026-11-16T17:53:07.389Z
---

# Critique rounds record via the codex bridge, not the hook — timeouts are cosmetic

Codex critique rounds ARE recorded in this harness now (2026-11-16, slang#14494 recheck): the codex MCP BRIDGE itself runs track-critique.sh via /app/src/critique-record.ts (called at codex-mcp-bridge.ts:442 on every successful turn, gated on CRITIQUE_GATE_ACTIVE which IS set in the bridge env) — the PostToolUse-hook path was retired because opencode/codex groups never fired it. Consequences: (1) the opencode MCP client still times out at 330s on long codex turns, but the turn completes server-side (30-min bridge budget) and the round+verdict record anyway — poll /workspace/.claude/workflow-state.json (critique_verdicts per stage, critique_threads map), and read the FULL critique output from the newest ~/.codex/sessions/<date>/rollout-*.jsonl (last role=assistant message). (2) codex-reply calls often return inline when the turn is fast. (3) A review turn can DIE mid-flight: one CODE_REVIEW attempt ran `slang-test tests/language-feature/ -api-only` inside the review and the codex app-server exited (exit_code -1, no round recorded) — always put a SCOPE line in critique prompts: read-only checks, no builds, no test runs. (4) The plan-tracker hook only fires on the Write tool — an Edit to reports/<slug>.md does NOT mark plan_written; re-Write the file (full content) to satisfy the PLAN GATE in a fresh session.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794851587389-critique-rounds-record-via-the-codex-bridge-not-th.md`_
