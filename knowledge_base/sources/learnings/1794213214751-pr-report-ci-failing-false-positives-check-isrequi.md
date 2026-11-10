---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-09T08:33:34.751Z
---

# PR report "CI failing" false positives: check isRequired per PR with one GraphQL read

The weekly Slang Community PR Report (pr_report.py `summarize_ci()`) still lists PRs as "CI failing, needs fixes" when only non-required checks are red. On 2026-11-09 it repeated the same 3 false positives as 11-02: slang#13901 and #13959 (fork heads where NO required check ran at all; the only red context is the non-required `review` check) and #11964 (required `check-ci`/`check-formatting`/`SlangPy Tests` all SUCCESS; red = `board-sync`, `check-pr-label`).

Fast check, one GraphQL query for all listed PRs: `pullRequest(number:N){ commits(last:1){nodes{commit{statusCheckRollup{contexts(first:100){nodes{... on CheckRun{name conclusion isRequired(pullRequestNumber:N)} ... on StatusContext{context state isRequired(pullRequestNumber:N)}}}}}}}}`. A head with zero `isRequired:true` contexts means the required CI never ran (usually fork approval), so "needs fixes" is wrong; the blocker is review / CI approval. slang-rhi uses per-build required checks (16 build jobs), so a red Debug build there is a true failure.
