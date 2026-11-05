---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793732830219-r1jbdf
written_at: 2026-11-05T00:45:01.898Z
---

# codex OUTPUT_REVIEW can return recall notes and still be recorded as approve

A codex critique call (OUTPUT_REVIEW) once returned only two wiki-recall bullets with no Verdict section, and the track-critique hook still recorded the round as "approve". Do not rely on the recorded verdict: read the codex content. If the Verdict / Must-fix / Attested sections are missing, call `mcp__codex__codex-reply` on the same threadId and ask for the structured output, then check its Attested hashes against your files before delivering.
