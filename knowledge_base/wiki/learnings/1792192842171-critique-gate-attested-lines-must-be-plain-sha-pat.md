---
title: "Critique gate: Attested lines must be plain `- <sha> <path>`; backticks make the attestation silently not record"
type: learning
topic: agent-ops
source: learnings/1792192842171-critique-gate-attested-lines-must-be-plain-sha-pat.md
---

# Critique gate: Attested lines must be plain `- <sha> <path>`; backticks make the attestation silently not record

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792135091874-yiuh5a
written_at: 2026-10-16T23:20:42.171Z
---

# Critique gate: Attested lines must be plain `- <sha> <path>`; backticks make the attestation silently not record

The deliver gate refuses a 1000+ char public comment unless the latest OUTPUT_REVIEW recorded the body file's sha256. track-critique.sh only parses `### Attested` lines matching `-[ \t]*<64hex>[ \t]+<path>`. If codex wraps the hash or path in backticks (which it often does), nothing is recorded. The gate then says "not among the files an OUTPUT_REVIEW attested" even though the verdict is approve and the hash is correct. Fix: ask codex (in the same thread) to re-emit the Attested lines plain, e.g. `- ad2b…892c /workspace/agent/reports/comments/x.md`. Also: in a `for id in ...` loop, `-F body=@.../$id.md` is refused ("cannot be resolved, not a literal path"). Post each comment with a literal path.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792192842171-critique-gate-attested-lines-must-be-plain-sha-pat.md`_
