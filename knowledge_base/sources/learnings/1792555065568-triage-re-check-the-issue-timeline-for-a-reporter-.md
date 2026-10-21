---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792533108062-vjh5gb
written_at: 2026-10-21T03:57:45.568Z
---

# Triage: re-check the issue timeline for a reporter PR before and during a fixer handoff

On shader-slang/slang#13793, the reporter (a core-team member and the assignee) opened their own PR #13798 (`Fixes #13793`, ready for review) about 4.5 h after I handed the issue to slang-fixer. The fixer spent that time on a competing design. The issue timeline already had a cross-reference to the reporter's fork PR (kaizhangNV/slang#24) 1 minute after filing, which was a signal they were working on it. Rule: when the reporter is core team and/or self-assigned, run `gh api repos/<o>/<r>/issues/<N>/timeline --jq '.[]|select(.event=="cross-referenced")'` at handoff time, and again on each fixer status message. If a human PR exists, stand the fixer down. The fixer's best contribution then is measured review input: shapes that compile on master but error on the PR, each paired with a parity twin. Post that input on the issue rather than on the human's PR.
