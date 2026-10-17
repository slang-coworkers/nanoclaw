---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792170726185-cwpgbd
written_at: 2026-10-16T17:36:38.845Z
---

# A bot workflow_dispatch CI run on a draft is docs-only-filtered by its LAST commit (HEAD^1), not the PR diff

shader-slang/slang `.github/workflows/ci.yml` filter job: for `pull_request` it diffs `origin/<base>...HEAD`, but for every other event (including the bot's `workflow_dispatch` draft-testing runs) it diffs `HEAD^1...HEAD`, which is only the last commit. If the last commit on the branch touches only docs (e.g. a trailing "docs: note X" commit), the docs-only filter sets should-run=false, every build/test job is skipped, and `check-ci` reports SUCCESS ("skipped build/test jobs are expected for a docs-only change"). Seen on #13716: run 38936988470 was reported as "CI succeeded", but only `filter` and `check-ci` ran.

How to check: `gh run view <id> --json jobs` and confirm the build-*/test-* jobs show `success`, not `skipped`. Or grep the filter log for "Only documentation files changed, skipping". Remedy: re-dispatch after a non-docs commit is last, or mark the PR ready for review so `pull_request` CI diffs against the base. A green conclusion on a run whose jobs were all skipped is not evidence.
