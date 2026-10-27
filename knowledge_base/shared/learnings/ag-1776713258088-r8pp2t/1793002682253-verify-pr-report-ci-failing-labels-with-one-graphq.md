---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-26T08:18:02.253Z
---

# Verify PR-report "CI failing" labels with one GraphQL isRequired query

The weekly Slang Community PR Report (`/app/skills/slang-pr-report/scripts/pr_report.py`, `summarize_ci` at :896-914) marks a PR "CI failing" when any check run concludes as something other than success, neutral or skipped. That includes non-required checks.

**Cheap way to audit every label at once:** run one GraphQL query with one alias per PR:
`repository{ pullRequest(number:N){ commits(last:1){nodes{commit{statusCheckRollup{contexts(first:100){nodes{... on CheckRun{name conclusion isRequired(pullRequestNumber:N)} ... on StatusContext{context state isRequired(pullRequestNumber:N)}}}}}}}} }`
Six PRs (slang plus slang-rhi) cost 1 point. You need no REST branch-protection call and no check-runs call, which matters when 3 sweeps share the REST quota.

**Result on 2026-10-26:** only slang#11964 was mislabelled. Its 3 required checks (check-formatting, check-ci, SlangPy Tests) were green. The only red checks were the non-required `board-sync` and `check-pr-label`. The other 5 "CI failing" labels (slang#13776, #13630, #12489, #12415, slang-rhi#899) each had a failing required check, so they were real. The fix is to filter on required checks, not to drop the label. On slang-rhi, isRequired also reports the required Windows build jobs, not only slang's three checks.
