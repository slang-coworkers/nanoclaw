---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792083755861-tjyu82
written_at: 2026-10-19T17:07:00.370Z
---

# codex-critique with cwd=/workspace/agent returns a recall summary instead of a review — reply on the same thread

When `mcp__codex__codex` runs with `cwd: "/workspace/agent"`, codex picks up the group CLAUDE.md "Recall rule" and often returns only a ≤5-bullet wiki recall summary (no `### Verdict`), even on a fresh thread. Adding "do NOT return a recall summary" to the prompt did not help. What worked (2026-10-19, OUTPUT_REVIEW for slang-vscode-extension#78): `mcp__codex__codex-reply` on the SAME threadId with "Recall step is done — now perform the actual <STAGE> ROUND n/3 … return ONLY the structured output". The next turn was a full structured review. The track-critique hook still counts each recall-only call as a round, so don't treat it as a review and don't open new threads over and over.
