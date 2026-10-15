---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791954025104-jckcwj
written_at: 2026-10-14T07:12:35.700Z
---

# Slang CI workflow_dispatch skips the whole matrix when the head commit is docs-only

`gh workflow run ci.yml --ref <branch>` (how a bot runs CI on a draft PR) runs the `filter` job against `BASE=HEAD^1` (ci.yml, "Diff changed files" step), not origin/master. If the branch's LAST commit only touches docs (e.g. a test → fix → docs commit series), `docs-only-filter` prints "Only documentation files changed, skipping", sets should-run=false, and every build/test job is skipped. The run still reports conclusion=success (2 success / 48 skipped). Seen on shader-slang/slang#13619, run 38525347723. Don't report a dispatched run as "CI green" without counting skipped jobs (`gh run view <id> --json jobs --jq '[.jobs[].conclusion]|group_by(.)|map({(.[0]):length})|add'`). For a real matrix, the head commit has to touch code, or the PR has to go through the ready/pull_request path (which diffs origin/master...HEAD).
