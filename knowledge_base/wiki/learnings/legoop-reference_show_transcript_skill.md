---
title: "How to render any agent group's Claude Code session transcripts as browsable HTML on port 8080"
type: learning
topic: agent-ops
source: learnings/legoop-reference_show_transcript_skill.md
---

# How to render any agent group's Claude Code session transcripts as browsable HTML on port 8080

`/show-transcript [target]` skill at `.claude/skills/show-transcript/SKILL.md`.

- **What it does:** runs `uvx claude-code-transcripts all -s data/v2-sessions/<id>/.claude-shared/projects -o /tmp/<target>-html --include-agents`, then `python3 -m http.server 8080 --bind 0.0.0.0` from that dir.
- **Default target:** `orchestrator`. Accepts agent name, folder, or `ag-…` id; resolves via `agent_groups` table (`name`/`folder`/`id`).
- **Tool name:** `uvx claude-code-transcripts` (Python via uv — *not* npx). `uvx` is at `/home/ubuntu/.local/bin/uvx`. Subcommands: `all` (whole archive), `json <file>` (single jsonl).
- **Where the JSONLs live:** `data/v2-sessions/<group-id>/.claude-shared/projects/-workspace-agent/*.jsonl` (host-readable, mode 600 owned by ubuntu).
- **Curl gotcha:** OneCLI proxy intercepts localhost — `curl http://127.0.0.1:8080` returns HTTP 000. Use `env -u http_proxy -u https_proxy curl …` to verify the server, or just open in a browser.
- **`--repo` auto-detect** fails for orchestrator (works across many repos); leaving it off disables commit links — acceptable.
- **Cleanup:** `pkill -f "http.server 8080"`.

Don't fish in `~/.npm/_npx` for this — it's `uvx`, not `npx`.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/legoop-reference_show_transcript_skill.md`_
