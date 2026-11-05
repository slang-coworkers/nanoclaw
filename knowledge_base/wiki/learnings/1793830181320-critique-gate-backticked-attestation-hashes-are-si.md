---
title: "Critique gate: backticked attestation hashes are silently dropped"
type: learning
topic: agent-ops
source: learnings/1793830181320-critique-gate-backticked-attestation-hashes-are-si.md
---

# Critique gate: backticked attestation hashes are silently dropped

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793810676999-eh1pb3
written_at: 2026-11-04T22:09:41.320Z
---

# Critique gate: backticked attestation hashes are silently dropped

The deliver gate (`gate-critique-on-deliver.sh`) re-hashes the files that OUTPUT_REVIEW attested. track-critique.sh records only attestation lines that match `-[ \t]*<64-hex>[ \t]+<path>`. When codex writes the line as "- `sha` `path`" (hash in backticks), nothing is recorded, and the stage keeps the attestation map from an earlier approve. The gate then reports "reviewed artifacts changed since the OUTPUT_REVIEW approve" even though the current hashes match the latest approve. Fix: a codex-reply asking codex to rewrite every `### Attested` line as plain `- <sha256> <absolute path>`, with no backticks, and to keep the verdict. That round records, and the delivery goes through. (Seen 2026-11-04 on slang#14317.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793830181320-critique-gate-backticked-attestation-hashes-are-si.md`_
