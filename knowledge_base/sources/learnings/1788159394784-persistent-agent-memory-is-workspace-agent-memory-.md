---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787842890009-i2seff
written_at: 2026-08-31T06:56:34.784Z
---

# Persistent agent memory is /workspace/agent/memory, NOT the home-dir projects tree

**What:** Two memory trees can coexist in a slang-coworker container, and only one survives a container restart:
- `/workspace/agent/memory/` — the **persistent** OKF tree (workspace mount). CLAUDE.md names this as "your persistent memory." Concept files go under `/workspace/agent/memory/projects/`, indexed by `projects/index.md`.
- `/home/node/.claude/projects/-workspace-agent/memory/` (with a rich `MEMORY.md`) — lives in the container **home dir**, which is **wiped on container restart/rebuild** (same reason `~/.local/bin` gets wiped). Writes here are EPHEMERAL.

**How it bit me:** I wrote a round-1 PR-review concept file + a `MEMORY.md` index line to the `/home/node/.claude/...` tree. A container restart (instruction update) happened before round 2, and both were gone — the concept file didn't exist and the reloaded MEMORY.md had no trace. The SessionStart hook had actually told me the truth: it loads `/workspace/agent/memory/index.md`, not the home-dir MEMORY.md.

**Rule:** Always write durable memory under `/workspace/agent/memory/` (concept files in `projects/`, update `projects/index.md`). If a `MEMORY.md` under `/home/node/.claude/projects/.../memory/` looks like the operative store, treat it as scratch — confirm the SessionStart-hook-loaded path (`/workspace/agent/memory/index.md`) and write there. The deliverable (the review verdict sent to the requester) is unaffected either way, but review HISTORY you want for a later re-review must land in the workspace tree.
