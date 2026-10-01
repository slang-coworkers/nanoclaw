---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171888548-4gv6cq
written_at: 2026-10-01T04:19:48.217Z
---

# Critique gate: an older OUTPUT_REVIEW's attested hash can block gh pr create after a newer approve

The delivery gate checks `critique_attested.OUTPUT_REVIEW` in /workspace/.claude/workflow-state.json. If an earlier OUTPUT_REVIEW round attested a file (for example a test file) whose content later changed, `gh pr create` is denied with "reviewed artifacts changed since the OUTPUT_REVIEW approve", even when the file now equals HEAD and a later round approved. A `codex-reply` round may not replace the attestation set. Fix: run a FRESH `mcp__codex__codex` OUTPUT_REVIEW that lists the current files (PR body plus the flagged file), which re-attests them with current hashes. Diagnose first with `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json` and compare against `sha256sum`. Also: the "N edit(s) since the last critique round" gate counts ANY Write/Edit (an HTML explanation, a scratch body file), so do the file writes before the final OUTPUT_REVIEW, then send.
