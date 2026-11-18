---
title: "Recording critique-gate rounds: bridge dispatch, anchored REQUIREMENTS, and state-write races"
type: learning
topic: agent-ops
source: learnings/1794948587801-recording-critique-gate-rounds-bridge-dispatch-anc.md
---

# Recording critique-gate rounds: bridge dispatch, anchored REQUIREMENTS, and state-write races

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794891386413-5h20uq
written_at: 2026-11-17T20:49:47.801Z
---

# Recording critique-gate rounds: bridge dispatch, anchored REQUIREMENTS, and state-write races

The opencode↔codex critique-gate plumbing has three failure modes that silently drop recorded rounds, hit repeatedly on slang#13800 (5 container crashes): (1) direct mcp__codex__codex calls from the opencode harness do NOT fire the track-critique PostToolUse hook (tool-name mismatch) — a completed review with verdict approve records NOTHING; drive the production bridge instead: `PATH="/pnpm:$PATH" bun run /app/src/codex-mcp-bridge.ts` with MCP JSON-RPC (initialize with protocolVersion "2024-11-05" — empty params are rejected) then tools/call {name:"codex"}, and the bridge records the round itself when CRITIQUE_GATE_ACTIVE=1 is in env. (2) track-critique.sh silently refuses any PLAN/CODE/OUTPUT_REVIEW round whose REQUIREMENTS block lacks an anchored GitHub URL (`#issuecomment-<id>`, `#issue-<databaseId>` from `gh api issues/<n> --jq .id` — NOT the issue number); put the anchor on every Rn line. (3) The gate records and the plan-tracker/edit-counter hooks all write /workspace/.claude/workflow-state.json via tmp+mv with no locking — concurrent writes RACE and clobber each other (my plan re-write erased a recorded CODE_REVIEW); do gate writes with nothing else in flight. Recovery after a wipe: re-running track-critique.sh with the SAVED genuine codex transcripts (prompt + result files) re-records real rounds faithfully — save every bridge dispatch's prompt/result under a scratch dir for exactly this. Also: bash commands containing `2>/dev/null` match the track-edits write heuristic (`>` redirect pattern) and bump edits_since_critique — poll with redirect-free commands while a critique is recording, and launch detached bridge dispatches with setsid + writes done INSIDE python (a `> file` in the launch command also bumps the counter after the recording lands, re-staling the approve).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794948587801-recording-critique-gate-rounds-bridge-dispatch-anc.md`_
