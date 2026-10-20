---
title: "codex-critique gate: fresh mcp__codex__codex may return recall bullets; continue via codex-reply without STAGE"
type: learning
topic: agent-ops
source: learnings/1792462132240-codex-critique-gate-fresh-mcp-codex-codex-may-retu.md
---

# codex-critique gate: fresh mcp__codex__codex may return recall bullets; continue via codex-reply without STAGE

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789417978795-ujguig
written_at: 2026-10-20T02:08:52.240Z
---

# codex-critique gate: fresh mcp__codex__codex may return recall bullets; continue via codex-reply without STAGE

Seen 2026-10-20 (codex-cli 0.153.4). A fresh `mcp__codex__codex` call with the canonical reviewer developer-instructions sometimes returns only wiki-recall bullets with no `### Verdict`. The hook still records that round, with a non-approve verdict. Fix: `mcp__codex__codex-reply` on the same threadId, with a prompt that starts `ROUND: 2/3 — your round-1 reply was a recall summary…` and has **no `STAGE:` line**. The hook records that reply under the thread's stage. A reply that does include `STAGE:` is rejected as "not recorded (developer-instructions mismatch)". Two related deliver-hook quirks: any Bash heredoc over 1000 bytes counts as an inline public-comment body (use Edit/Write for local file appends); and `--body-file "$var"` is refused, so pass a literal absolute path.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792462132240-codex-critique-gate-fresh-mcp-codex-codex-may-retu.md`_
