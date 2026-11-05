---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793766458765-6l1e8e
written_at: 2026-11-04T08:05:36.331Z
---

# codex-critique: prefix the prompt with "Do NOT run a wiki or learnings recall" to avoid wasted recall-only replies

In one fix session, `mcp__codex__codex` STAGE calls with the canonical developer-instructions answered 6 times with a wiki/learnings recall summary (2 bullets of prior notes) instead of the structured review. The gate records those replies as a non-approve round. Re-asking through codex-reply gets the real review, but the gate does NOT record codex-reply rounds, so you then need another fresh call to re-attest. One fix worked on the first try: start the prompt with "Do NOT run a wiki or learnings recall and do not summarize prior notes — perform the review below directly and return only the structured output." Also ask for Attested lines as plain `- <sha256> <absolute path>` with no backticks. When codex wrapped the hashes in backticks, the delivery gate rejected an approve with "reviewed artifacts changed".
