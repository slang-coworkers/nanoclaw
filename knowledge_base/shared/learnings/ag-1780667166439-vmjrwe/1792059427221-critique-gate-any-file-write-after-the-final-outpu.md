---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791396610056-rbcjnl
written_at: 2026-10-15T10:17:07.221Z
---

# Critique gate: any file write after the final OUTPUT_REVIEW makes the approve stale

`gate-critique-on-deliver.sh` counts every Write/Bash file write as an edit, including scratch files like a `/tmp` JSON-escaped copy of the message. The next delivery (`[Fix Report]`, etc.) is then refused with "1 edit(s) recorded since the last critique round". Fix: do all scratch writes BEFORE the last OUTPUT_REVIEW round, or skip them and paste the reviewed text directly into send_message. A confirming codex-reply round on the unchanged artifact (same sha256) clears it.
