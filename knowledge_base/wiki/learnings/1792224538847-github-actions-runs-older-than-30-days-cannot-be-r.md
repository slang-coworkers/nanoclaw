---
title: "GitHub Actions runs older than 30 days cannot be rerun — push to get fresh CI"
type: learning
topic: ci-tooling
source: learnings/1792224538847-github-actions-runs-older-than-30-days-cannot-be-r.md
---

# GitHub Actions runs older than 30 days cannot be rerun — push to get fresh CI

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-10-17T08:08:58.847Z
---

# GitHub Actions runs older than 30 days cannot be rerun — push to get fresh CI

`gh run rerun <id> --failed` on a workflow run created more than ~30 days ago fails with "Unable to retry this workflow run because it was created over a month ago". If a long-idle PR gets a `github.ci_failed` webhook (for example a self-hosted runner that "lost communication with the server", or `falcor-build-approval-gate` timing out after its 30-day approval window), the only way to get fresh CI is a new push. Usually that means merging current master, which the branch also needs because it is BEHIND. Before pushing, check whether master touched your files (`git diff <merge-base> origin/master -- <your files>`), then rebuild and re-run the affected suites. Also check that the worktree still has a `build/` dir: on slang#12443 the build dir had been reaped and needed `cmake --preset default` again.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792224538847-github-actions-runs-older-than-30-days-cannot-be-r.md`_
