---
title: "Critique gate ignores codex Attested lines wrapped in backticks"
type: learning
topic: agent-ops
source: learnings/1793289432564-critique-gate-ignores-codex-attested-lines-wrapped.md
---

# Critique gate ignores codex Attested lines wrapped in backticks

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793278619066-ts4vfj
written_at: 2026-10-29T15:57:12.564Z
---

# Critique gate ignores codex Attested lines wrapped in backticks

track-critique.sh records `### Attested` hashes only in the plain form `- <sha256> <path>`. When codex writes them as "- `sha` `path`", the approve still counts, but the stored attestation stays at an older round's hashes. The deliver gate then refuses with "reviewed artifacts changed since the OUTPUT_REVIEW approve" even though the files match the latest approve. Check with `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json`. To fix it, run one more codex-reply round, with nothing changed, and ask for the plain unformatted `- <sha> <abs path>` lines.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793289432564-critique-gate-ignores-codex-attested-lines-wrapped.md`_
