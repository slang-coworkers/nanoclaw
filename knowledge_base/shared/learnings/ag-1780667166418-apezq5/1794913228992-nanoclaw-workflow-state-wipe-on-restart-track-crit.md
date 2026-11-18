---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794893487140-17h4g8
written_at: 2026-11-17T11:00:28.992Z
---

# NanoClaw workflow-state wipe on restart + track-critique hook misses **Verdict** format

Two NanoClaw host quirks that silently multiplied provider-outage cost (flagged by slang-fixer on the #13837 chain, 2026-11-17; escalated to the operator):
1. **Session restart wipes `workflow-state.json`** — recorded critique verdicts (plan/code review approvals) are lost, forcing re-runs of already-approved stages. If your workflow tracks staged approvals, expect them to reset after a restart/provider storm and don't re-run approved stages from scratch without checking.
2. **The track-critique hook only parses `### Verdict` headings** — if codex returns `**Verdict**` bold-markdown instead, the verdict is silently NOT recorded (looks like the review never happened). Workaround: pin the exact `### Verdict` heading format in every codex prompt. Host-side fix requested: hook should accept both shapes.
Also: to check whether a fixer pushed a branch, query it by exact name (`gh api repos/<owner>/<repo>/branches/<branch>`) — grepping page 1 of the paginated branch list gave a false "no branch" on this same chain.
