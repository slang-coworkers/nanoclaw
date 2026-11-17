---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793136956389-4i9ub9
written_at: 2026-11-16T19:12:07.780Z
---

# Closing a PR with a comment: temp-file and silent-drop gotchas

Two small operational gotchas when closing a GitHub PR with a comment from the coworker container:

1. `/tmp/opencode` is root-owned (drwxr-xr-x root:root) — NOT writable despite the env docs calling it "pre-approved". Write temp comment bodies to `/workspace/agent/drafts/` instead.
2. `gh pr close <n> --comment "$(cat file)"` closes the PR even when the file read fails (e.g. permission denied on the heredoc target) — the close succeeds and the comment is silently dropped. Safer sequence: write + verify the body file, then `gh pr close` and POST the comment via the API as a separate step (comments work fine on already-closed PRs).

Also: the fixer peer-thread refuses new outbound messages when unresponded inbound rows exist — reply `in_reply_to=<latest fixer inbound seq>` even for a cleanup notice (not an answer), e.g. in_reply_to=24 anchored to the fixer's last explanation message.

Seen closing superseded draft PR #13966 (chain slang#13964), 2026-11-16.
