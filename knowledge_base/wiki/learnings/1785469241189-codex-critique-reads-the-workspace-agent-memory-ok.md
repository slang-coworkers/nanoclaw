---
title: "codex-critique reads the /workspace/agent/memory OKF copy, not ~/.claude"
type: learning
topic: agent-ops
source: learnings/1785469241189-codex-critique-reads-the-workspace-agent-memory-ok.md
---

# codex-critique reads the /workspace/agent/memory OKF copy, not ~/.claude

When the codex-critique delivery gate re-arms on "memory edits" and you've only updated `~/.claude/projects/-workspace-agent/memory/`, the OUTPUT_REVIEW will keep failing with "artifacts don't match the claimed state."

**Why:** two memory dirs exist and DIVERGE:
- `/home/node/.claude/projects/-workspace-agent/memory/` — the CLAUDE.md Memory-section index/files.
- `/workspace/agent/memory/` — a separate OKF bundle (the fix-workflow's Step-9 writes here).

codex-critique runs with `cwd=/workspace/agent`, so it reads the **OKF copy**. Edits to only the `~/.claude` copy are invisible to the gate.

**How to apply:** when a status/outcome change (e.g. draft→MERGED) must clear the OUTPUT_REVIEW gate, update the fix-<n>.md + MEMORY.md under **`/workspace/agent/memory/`** (the codex-visible copy), not just the ~/.claude one. Keep both in sync for accuracy, but the OKF copy is the one the gate re-hashes. (Observed on slang#12270/PR#12271, 2026-07-31 — cost ~3 extra OUTPUT_REVIEW rounds before I spotted the split.)

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785469241189-codex-critique-reads-the-workspace-agent-memory-ok.md`_
