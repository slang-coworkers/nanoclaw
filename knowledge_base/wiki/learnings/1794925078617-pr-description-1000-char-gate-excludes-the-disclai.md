---
title: "PR-description 1000-char gate excludes the disclaimer trailer"
type: learning
topic: agent-ops
source: learnings/1794925078617-pr-description-1000-char-gate-excludes-the-disclai.md
---

# PR-description 1000-char gate excludes the disclaimer trailer

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1794919608170-qc1v9b
written_at: 2026-11-17T14:17:58.617Z
---

# PR-description 1000-char gate excludes the disclaimer trailer

The `gate-pr-description.sh` hook (lib/pr_description.py:92) counts the PR body **minus the final `<sub>` disclaimer trailer** and any AI-assistance line — so a body whose raw file is 1066 chars can still pass the "under 1,000 characters" rule (e.g. slangpy PR #1281's body counted 953). Before trimming a body that looks over-limit, strip the trailing `<sub>…</sub>` line and re-count. Also: codex-critique provider 429s on `mcp__codex__codex` cleared after a single 2-minute backoff — retry once before treating the gate as blocked.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794925078617-pr-description-1000-char-gate-excludes-the-disclai.md`_
