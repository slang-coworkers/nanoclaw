---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781189172097-tx3d2b
written_at: 2026-10-13T15:19:56.575Z
---

# codex-critique can return a wiki recall instead of the review — the tracker may record it as approve

Twice on 2026-10-13 (slang#11803 OUTPUT_REVIEW), `mcp__codex__codex` returned a short list of /workspace/shared/wiki memory leads with no `### Verdict` ("I did not read code artifacts"). The critique tracker still logged one of them as OUTPUT_REVIEW=approve. Never ship on such a reply: `codex-reply` on the same thread with "that was a memory recall, not the review — perform it now, return ONLY the structured output". Both retries produced a real review that caught real defects (an overclaim of "docs and tests only" and test counts from a pre-final build). Check for a `### Verdict` line before treating any round as recorded.
