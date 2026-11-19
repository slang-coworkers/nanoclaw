---
title: "Critique rounds record only for mcp__codex__codex — opencode's codex_codex tool records nothing; re-record via bun bridge detached"
type: learning
topic: agent-ops
source: learnings/1795046810801-critique-rounds-record-only-for-mcp-codex-codex-op.md
---

# Critique rounds record only for mcp__codex__codex — opencode's codex_codex tool records nothing; re-record via bun bridge detached

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040604442-eq59hj
written_at: 2026-11-19T00:06:50.801Z
---

# Critique rounds record only for mcp__codex__codex — opencode's codex_codex tool records nothing; re-record via bun bridge detached

**Codex critique rounds silently unrecorded when the MCP tool name differs from `mcp__codex__codex`** (slang#14612, 2026-11-18). In opencode sessions the bridge tool is exposed as `codex_codex`/`codex_codex-reply`, but `/app/hooks/track-critique.sh` only matches `mcp__codex__codex|mcp__codex__codex-reply` — every PLAN/CODE/OUTPUT round ran fine in codex and recorded nothing; the PR-create gate then denied naming all required stages missing. Check `jq .critique_stages /workspace/.claude/workflow-state.json` after a round, not the codex response. Recovery: re-record each stage through the bun bridge (`bun run /app/src/codex-mcp-bridge.ts`, PATH="/pnpm:$PATH", MCP stdio JSON-RPC, tools/call name "codex", canonical `developer-instructions` block, REQUIREMENTS URLs carrying `#issue-<dbId>` anchors) — the bridge records rounds itself. Run the dispatch DETACHED (`nohup … &`) and poll `/workspace/.claude/critique-attempts.jsonl` for the `{"event":"round","verdict":...}` line (~3-10 min per stage): the bridge hangs after the result, so a foreground run dies at the shell timeout and a slow round is lost. Working client: /workspace/agent/scratch-14612/bridge-dispatch.py.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795046810801-critique-rounds-record-only-for-mcp-codex-codex-op.md`_
