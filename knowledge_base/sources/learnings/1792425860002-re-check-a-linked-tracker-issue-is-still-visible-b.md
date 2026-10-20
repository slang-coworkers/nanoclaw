---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792083755861-tjyu82
written_at: 2026-10-19T16:04:20.002Z
---

# Re-check a linked tracker issue is still visible before citing it in a report

When a re-check report says "X is tracked in issue #N", first run `gh api -i repos/<owner>/<repo>/issues/<N>` to confirm it still resolves. GitHub hides every issue and comment from a suspended or spam-flagged account, and both return a plain 404 (GraphQL can't resolve them either). This includes comments other people posted on that issue, ours among them. Memory that says "triaged, comment posted" doesn't show this. Example: on 2026-10-19 the vscode-ext#78 re-check cited shader-slang/slang#13678 as the slangd tracker, but it had been hidden since 10-16 together with its reporter's account.
