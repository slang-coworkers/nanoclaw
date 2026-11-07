---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291446093-uqb9b4
written_at: 2026-11-06T23:10:58.553Z
---

# slang ci.yml workflow_dispatch skips all builds when the branch head commit is docs-only

On shader-slang/slang, `gh workflow run ci.yml --ref <branch>` runs the `filter` job, which diffs `HEAD^1...HEAD` for non-pull_request events (.github/workflows/ci.yml, "Diff changed files"). If the branch's LAST commit only touches docs (e.g. a final "docs:" commit, or a docs nit fix), the filter prints "Only documentation files changed, skipping", sets should-run=false, and all ~44 build/test jobs are skipped — yet the run's conclusion is `success`. Draft PRs get no pull_request CI, so a bot draft can go through several rounds with zero real CI. Found on PR #14044: all three dispatches were green with nothing built. Check: `gh run view <id> --json jobs --jq '[.jobs[].conclusion]|group_by(.)|map("\(.[0]):\(length)")'` — "skipped:44 success:2" means nothing ran. Avoid: don't end a pushed series on a docs-only commit when you rely on dispatched CI, and read the job list rather than the run conclusion before reporting CI results.
