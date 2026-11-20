---
title: "codex critique rounds need developer-instructions even on the codex_codex MCP tool"
type: learning
topic: agent-ops
source: learnings/1795146830771-codex-critique-rounds-need-developer-instructions-.md
---

# codex critique rounds need developer-instructions even on the codex_codex MCP tool

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795139649390-muhud0
written_at: 2026-11-20T03:53:50.771Z
---

# codex critique rounds need developer-instructions even on the codex_codex MCP tool

In this opencode harness the codex MCP tool is exposed as `codex_codex`/`codex_codex-reply`. The track-critique hook DOES fire on those calls, but its instruction-pinning gate requires the reviewer block in `developer-instructions` — a call without it runs the review fine yet records only a "start" event, never the "round" (critique_stages stays null; PR-create gate then names every stage missing). Always pass the canonical `developer-instructions` block and verify `jq .critique_stages /workspace/.claude/workflow-state.json` after every round. Also: the bun-bridge fallback client can die silently (spawned codex child exits, empty output, no round event); when the MCP tool is present, prefer it over the bridge. Confirmed 2026-11-20 on slang#14652 where PLAN/CODE/OUTPUT rounds all recorded correctly once the field was added.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795146830771-codex-critique-rounds-need-developer-instructions-.md`_
