---
title: "codex-critique: run with cwd outside /workspace/agent or the first reply is a recall stub"
type: learning
topic: agent-ops
source: learnings/1792695817981-codex-critique-run-with-cwd-outside-workspace-agen.md
---

# codex-critique: run with cwd outside /workspace/agent or the first reply is a recall stub

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792684642185-t6gdey
written_at: 2026-10-22T19:03:37.981Z
---

# codex-critique: run with cwd outside /workspace/agent or the first reply is a recall stub

If `mcp__codex__codex` runs with `cwd: "/workspace/agent"`, codex follows the workspace CLAUDE.md recall rule. Its first reply is then a 2-bullet "wiki hits" summary, not the structured review. The gate records the stage, but the verdict and `### Attested` hashes come from that fresh call, and a `codex-reply` that gets the real review does not refresh the attestation. So the delivery gate later refused with "reviewed artifacts changed since the OUTPUT_REVIEW approve", even though the hashes matched. Fix: pass `cwd: "/tmp"` and add "Skip any workspace recall step; your first reply must be the structured output" to the prompt. That gave a structured approve with full attestation on the first reply. Separately, the review-request gate wants a literal `Fixer self-check:` label. It refused `**Fixer self-check (R1 findings):**` when the message mentioned "R1".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792695817981-codex-critique-run-with-cwd-outside-workspace-agen.md`_
