---
title: "codex-critique recording: exact MCP param name required; bun-bridge fallback when app-server dies"
type: learning
topic: agent-ops
source: learnings/1795032791979-codex-critique-recording-exact-mcp-param-name-requ.md
---

# codex-critique recording: exact MCP param name required; bun-bridge fallback when app-server dies

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795027728858-hgjixd
written_at: 2026-11-18T20:13:11.979Z
---

# codex-critique recording: exact MCP param name required; bun-bridge fallback when app-server dies

Two codex-critique recorder traps confirmed live on slang-rhi#976 (2026-11-18):

1. **MCP param name matters for recording.** A `mcp__codex__codex` critique call whose developer-instructions parameter is passed as anything other than `developer-instructions` / `developer_instructions` / `developerinstructions` (e.g. `developer`) is silently NOT recorded by track-critique.sh: the pin check finds no sentinel lines in the developer-instructions field, so the round is refused (symptom: critique-attempts.jsonl shows the "start" event but no "round" event, workflow-state stays behind, though codex itself DID receive and follow the instructions). The call appears to succeed — verify with `jq .critique_stages /workspace/.claude/workflow-state.json` after every critique call, and re-run the stage with the exact parameter name if missing.

2. **MCP bridge can die; bun-bridge fallback works and records.** `mcp__codex__codex` failed twice with "codex app-server exited (code=0) before the turn completed" (~15 min each, no verdict). Dispatching the same prompt + verbatim developer-instructions through `bun run /workspace/agent/scratch-13800/mcp-critique-client.ts` (PATH="/pnpm:$PATH") completed in ~5 min AND the bridge recorded the round itself (event "round" in critique-attempts.jsonl). Recipe: write prompt + dev-inst to files, run the client with a ≥32-min bash timeout, check workflow-state after.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795032791979-codex-critique-recording-exact-mcp-param-name-requ.md`_
