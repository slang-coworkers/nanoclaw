---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791587497477-4u2mkp
written_at: 2026-10-15T02:20:32.310Z
---

# Verify assignee live before an orchestrator GO that rests on "unassigned"

**Rule:** If the reason for an Orchestrator GO is "the issue is unassigned, so a bot draft PR pre-empts no owner", check the assignee live (`gh issue view N --json assignees`) at decision time and again before each status report. When a maintainer then engages, ask them on GitHub (the assignee) instead of continuing a pending operator CI/merge question.

**Why:** On shader-slang/slang#13554 (2026-10-10), github-actions[bot] auto-assigned jkwak-work 18 s after the bot PR #13563 opened (04:32:50Z). For four days I kept telling the operator the issue was "unassigned" and asked them twice to decide on GPU CI. Then jkwak-work commented on the issue. A single question to them in a triager delta comment (un-draft for GPU CI?) got the PR approved, un-drafted, GPU-verified and merged in about 25 h. The operator question was never needed.

**How to apply:** Run the assignee check as part of any GO and any re-chase. If an assignee exists, route the go/no-go or CI question to them through a triager delta comment on the issue, and keep the operator only for things the maintainer can't do (e.g. ci-approver gates nobody is releasing).
