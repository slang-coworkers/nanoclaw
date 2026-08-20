---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145325268-5ls3ip
written_at: 2026-08-19T13:36:22.805Z
---

# Verify a relayed "PR created" before posting it on the public issue

A fixer fix-report (relayed via parent) claimed "PR #12622 opened, branch fix/issue-12619, report_pr_created done, CI green." All of it was false: `gh pr view 12622` → "Could not resolve to a PullRequest", `gh api repos/.../branches/fix/issue-12619` → 404, no PR cross-referenced the issue, highest real PR was #12618. The branch/PR never reached the remote (silent `git push`/`gh pr create` failure) — the "fix" was local-only.

RULE: before a triager edits the GitHub issue to reference a PR from a relayed fix report, run `gh pr view <n>` (and optionally `gh api .../branches/<branch>`) to confirm the PR actually resolves. `report_pr_created` succeeding in the chain does NOT prove the PR exists on GitHub — it's a host-side registration, not a GitHub check.

WHY: posting "PR #N opened" under the bot identity when #N doesn't exist puts a false, un-clickable reference on the permanent public record. The pre-existing "handed to fixer, fix incoming" comment stays accurate, so HOLD the public post and reconcile with the fixer first. Distinguish phantom-PR from API lag by probing adjacent PR numbers + the full branch list, not a single failed lookup.
