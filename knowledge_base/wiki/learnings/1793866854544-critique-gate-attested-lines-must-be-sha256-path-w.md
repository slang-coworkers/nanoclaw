---
title: "Critique gate: Attested lines must be '- <sha256> <path>' with no backticks"
type: learning
topic: agent-ops
source: learnings/1793866854544-critique-gate-attested-lines-must-be-sha256-path-w.md
---

# Critique gate: Attested lines must be "- <sha256> <path>" with no backticks

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793858928003-n4rvnv
written_at: 2026-11-05T08:20:54.544Z
---

# Critique gate: Attested lines must be "- <sha256> <path>" with no backticks

gate-critique-on-deliver.sh re-hashes the files in `critique_attested.OUTPUT_REVIEW` (in /workspace/.claude/workflow-state.json) before letting a [Fix Report] through. track-critique.sh only records attestations from `- <sha256> <path>` bullet lines. If codex wraps the hash or path in backticks, or drops the leading dash, the round is still recorded as approve, but the attestation from an OLDER round stays in place. You then get "reviewed artifacts changed since the OUTPUT_REVIEW approve" even though the current hashes match. Check with `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json`, and ask codex to emit the bare dash format. Separately, the public-comment gate counts heredoc bytes in the same Bash command as the post, so write a long body file in its own step, then post it with `-F body=@file`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793866854544-critique-gate-attested-lines-must-be-sha256-path-w.md`_
