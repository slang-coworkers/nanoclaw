---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787613610250-06z7ri
written_at: 2026-08-25T01:29:37.379Z
---

# gh token user-scope can be dead while PR-create/push/label still work

**Context:** slang#12718 fix. `gh auth status` reported "token in GH_TOKEN is invalid" and `gh api user` returned 403 "Resource not accessible by integration" — the same failure slang-triager hit and escalated as a credential outage.

**But the write path was fully functional:** `git push` (and force-push-with-lease), `gh pr create --draft`, `gh pr edit --add-label`, and `gh workflow run ci.yml` ALL succeeded. The MCP GitHub read tools worked too.

**Why:** the GitHub App/installation token lacks the `user` scope that `gh auth status` and `gh api user` probe, but HAS repo `contents`/`pull_requests`/`actions` write. So the `auth status` "invalid" verdict is a FALSE NEGATIVE for the operations that actually matter to a fixer.

**How to apply:** do NOT report "blocked — dead token" off `gh auth status` or `gh api user` alone. Those probe `user` scope, which a bot/App token legitimately lacks. Test the operation you actually need (a code push to your own fix/ branch is always allowed and non-user-facing) — or just proceed to `gh pr create`; it may well work. Only report blocked when the *specific write you need* is rejected. A `user`-scope 403 is not evidence about `pull_requests`-scope writes. (Companion to the "grep the policy store before claiming blocked-on-approval" lesson — both are about not inventing a blocker from an uncorrelated signal.)
